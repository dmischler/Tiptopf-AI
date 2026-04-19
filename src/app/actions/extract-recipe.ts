'use server'

import { z } from 'zod'

import { decryptApiKey } from '@/lib/crypto'
import { extractRecipeFromText } from '@/lib/ai/extractor'
import { generateRecipeImageWithAi } from '@/lib/ai/image-generator'
import { searchPexelsImages } from '@/lib/ai/image-search'
import { searchMealDbImages } from '@/lib/ai/meal-db'
import type { RecipeCategory } from '@/types'
import type { RecipeImageCandidate, ResolvedRecipeImage } from '@/lib/ai/image-types'
import { DEFAULT_BASE_URL } from '@/lib/ai/client'
import { fetchRecipeUrl } from '@/lib/ai/url-fetcher'
import { extractRecipeFromImage } from '@/lib/ai/image-handler'
import { downloadImageToLocalStorage, saveRecipeImageBytes } from '@/lib/local/images'
import { getProfile, LOCAL_PROFILE_ID } from '@/lib/local/store'

const categorySchema = z.enum(['starter', 'main', 'dessert', 'side', 'breakfast', 'snack'])
const titleSchema = z.string().trim().min(1).max(180)
const imageUrlSchema = z.string().url()

const findRecipeImageInputSchema = z.object({
  title: titleSchema,
  category: categorySchema,
  ingredients: z.array(z.string()).default([]),
})

type FindRecipeImageInput = z.infer<typeof findRecipeImageInputSchema>

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

function buildImageSearchQuery(title: string, category: RecipeCategory) {
  const suffixByCategory: Record<RecipeCategory, string> = {
    starter: 'starter dish',
    main: 'main course',
    dessert: 'dessert plated',
    side: 'side dish',
    breakfast: 'breakfast plate',
    snack: 'snack plated',
  }

  return `${title} ${suffixByCategory[category]} food photo`
}

async function collectImageCandidates(title: string, category: RecipeCategory): Promise<RecipeImageCandidate[]> {
  const pexelsQuery = buildImageSearchQuery(title, category)

  try {
    const pexelsCandidates = await searchPexelsImages(pexelsQuery, 8)
    if (pexelsCandidates.length > 0) {
      return pexelsCandidates
    }
  } catch {
    // Continue to fallback
  }

  return searchMealDbImages(title, 4)
}

async function generateRecipeImage(input: FindRecipeImageInput): Promise<ResolvedRecipeImage | null> {
  let config: UserApiConfig

  try {
    config = await getUserApiConfig()
  } catch {
    return null
  }

  try {
    const generated = await generateRecipeImageWithAi({
      title: input.title,
      category: input.category,
      ingredients: input.ingredients,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    })

    if (generated.bytes) {
      const imageUrl = await saveRecipeImageBytes(
        generated.bytes,
        crypto.randomUUID(),
        generated.mimeType ?? null
      )

      return {
        imageUrl,
        source: 'ai',
      }
    }

    if (generated.url) {
      const imageUrl = await downloadImageToLocalStorage(generated.url, crypto.randomUUID())
      return {
        imageUrl,
        source: 'ai',
      }
    }
  } catch {
    return null
  }

  return null
}

export async function searchRecipeImageCandidatesAction(
  title: string,
  category: RecipeCategory
): Promise<RecipeImageCandidate[]> {
  const parsedTitle = titleSchema.parse(title)
  const parsedCategory = categorySchema.parse(category)
  return collectImageCandidates(parsedTitle, parsedCategory)
}

export async function applyRecipeImageCandidateAction(imageUrl: string): Promise<string> {
  const parsedImageUrl = imageUrlSchema.parse(imageUrl)
  return downloadImageToLocalStorage(parsedImageUrl, crypto.randomUUID())
}

export async function generateRecipeImageAction(
  input: FindRecipeImageInput
): Promise<ResolvedRecipeImage | null> {
  const parsedInput = findRecipeImageInputSchema.parse(input)
  return generateRecipeImage(parsedInput)
}

export async function findRecipeImageAction(input: FindRecipeImageInput): Promise<ResolvedRecipeImage | null> {
  const parsedInput = findRecipeImageInputSchema.parse(input)
  const candidates = await collectImageCandidates(parsedInput.title, parsedInput.category)

  for (const candidate of candidates) {
    try {
      const imageUrl = await downloadImageToLocalStorage(candidate.url, crypto.randomUUID())
      return {
        imageUrl,
        source: candidate.source,
        creditName: candidate.creditName,
        creditUrl: candidate.creditUrl,
      }
    } catch {
      // Try next candidate
    }
  }

  return generateRecipeImage(parsedInput)
}

export async function extractFromUrlAction(url: string) {
  const normalizedUrl = url.trim()
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    throw new Error('URL must start with http:// or https://')
  }

  const { content, imageUrl, structuredRecipe } = await fetchRecipeUrl(normalizedUrl)
  let recipe = structuredRecipe

  if (!recipe) {
    const { apiKey, baseUrl } = await getUserApiConfig()
    recipe = await extractRecipeFromText(content, apiKey, baseUrl, true)
  }

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
