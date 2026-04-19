'use server'

import { decryptApiKey } from '@/lib/crypto'
import { extractRecipeFromText } from '@/lib/ai/extractor'
import { DEFAULT_BASE_URL } from '@/lib/ai/client'
import { fetchRecipeUrl } from '@/lib/ai/url-fetcher'
import { extractRecipeFromImage } from '@/lib/ai/image-handler'
import { downloadImageToLocalStorage } from '@/lib/local/images'
import { getProfile, LOCAL_PROFILE_ID } from '@/lib/local/store'

type UserApiConfig = {
  apiKey: string
  baseUrl: string
}

async function getUserApiConfig(): Promise<UserApiConfig> {
  const profile = await getProfile()
  const userId = LOCAL_PROFILE_ID

  if (!profile?.encrypted_api_key) {
    throw new Error(
      'No API key configured in profile settings. Add one for pages without structured recipe metadata.'
    )
  }

  const apiKey = await decryptApiKey(profile.encrypted_api_key, userId)

  return {
    apiKey,
    baseUrl: profile.api_base_url || DEFAULT_BASE_URL,
  }
}

export async function extractFromUrlAction(url: string) {
  const normalizedUrl = url.trim()
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    throw new Error('URL must start with http:// or https://')
  }

  const { content, imageUrl, structuredRecipe } = await fetchRecipeUrl(normalizedUrl)
  const recipe = structuredRecipe
    ? structuredRecipe
    : await (async () => {
        const { apiKey, baseUrl } = await getUserApiConfig()
        return extractRecipeFromText(content, apiKey, baseUrl, true)
      })()

  let storedImageUrl: string | null = null
  if (imageUrl) {
    try {
      storedImageUrl = await downloadImageToLocalStorage(imageUrl, crypto.randomUUID())
    } catch {
      storedImageUrl = null
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
