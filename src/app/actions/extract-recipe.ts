'use server'

import { decryptApiKey } from '@/lib/crypto'
import { createClient } from '@/lib/supabase/server'
import { extractRecipeFromText } from '@/lib/ai/extractor'
import { fetchRecipeUrl, downloadImageToStorage } from '@/lib/ai/url-fetcher'
import { extractRecipeFromImage } from '@/lib/ai/image-handler'

type UserApiConfig = {
  userId: string
  apiKey: string
  baseUrl: string
}

const DEFAULT_BASE_URL = 'https://api.opencode.ai/v1'

async function getUserApiConfig(): Promise<UserApiConfig> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('encrypted_api_key, api_base_url')
    .eq('id', user.id)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (!profile?.encrypted_api_key) {
    throw new Error('No API key configured in profile settings.')
  }

  const apiKey = await decryptApiKey(profile.encrypted_api_key, user.id)

  return {
    userId: user.id,
    apiKey,
    baseUrl: profile.api_base_url || DEFAULT_BASE_URL,
  }
}

export async function extractFromUrlAction(url: string) {
  const normalizedUrl = url.trim()
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    throw new Error('URL must start with http:// or https://')
  }

  const { userId, apiKey, baseUrl } = await getUserApiConfig()
  const { content, imageUrl } = await fetchRecipeUrl(normalizedUrl)
  const recipe = await extractRecipeFromText(content, apiKey, baseUrl, true)

  let storedImageUrl: string | null = null
  if (imageUrl) {
    try {
      storedImageUrl = await downloadImageToStorage(imageUrl, userId, crypto.randomUUID())
    } catch {
      storedImageUrl = imageUrl
    }
  }

  return {
    ...recipe,
    image_url: storedImageUrl,
    source_url: normalizedUrl,
    source_type: 'url' as const,
  }
}

export async function extractFromImageAction(imageBase64: string) {
  if (!imageBase64) {
    throw new Error('No image payload provided')
  }

  const { apiKey, baseUrl } = await getUserApiConfig()
  const recipe = await extractRecipeFromImage(imageBase64, apiKey, baseUrl)

  return {
    ...recipe,
    source_type: 'image' as const,
  }
}
