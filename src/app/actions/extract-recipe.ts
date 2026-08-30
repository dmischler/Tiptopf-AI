'use server'

import { z } from 'zod'

import { revalidateApp } from '@/app/actions/_revalidate'
import { extractRecipeFromText } from '@/lib/ai/extractor'
import { searchPexelsImages } from '@/lib/ai/image-search'
import { searchMealDbImages } from '@/lib/ai/meal-db'
import type { RecipeCategory } from '@/types'
import type { RecipeImageCandidate, ResolvedRecipeImage } from '@/lib/ai/image-types'
import { resolveAiBaseUrl } from '@/lib/ai/client'
import { fetchRecipeUrl } from '@/lib/ai/url-fetcher'
import { extractRecipeFromImage } from '@/lib/ai/image-handler'
import { downloadImageToLocalStorage } from '@/lib/local/images'
import { getSettings, patchRecipe } from '@/lib/local/store'

const categorySchema = z.enum(['starter', 'main', 'dessert', 'side', 'breakfast', 'snack'])
const titleSchema = z.string().trim().min(1).max(180)
const imageUrlSchema = z.string().url()
const recipeIdSchema = z.string().uuid()

const findRecipeImageInputSchema = z.object({
  title: titleSchema,
  category: categorySchema,
  ingredients: z.array(z.string()).default([]),
})

type FindRecipeImageInput = z.infer<typeof findRecipeImageInputSchema>

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

async function collectImageCandidates(
  title: string,
  category: RecipeCategory,
  pexelsApiKey: string | null
): Promise<RecipeImageCandidate[]> {
  const pexelsQuery = buildImageSearchQuery(title, category)

  try {
    const pexelsCandidates = pexelsApiKey ? await searchPexelsImages(pexelsQuery, pexelsApiKey, 8) : []
    if (pexelsCandidates.length > 0) {
      return pexelsCandidates
    }
  } catch {
    // Continue to fallback
  }

  return searchMealDbImages(title, 4)
}

export async function searchRecipeImageCandidatesAction(
  title: string,
  category: RecipeCategory
): Promise<RecipeImageCandidate[]> {
  const settings = await getSettings()
  const parsedTitle = titleSchema.parse(title)
  const parsedCategory = categorySchema.parse(category)
  return collectImageCandidates(parsedTitle, parsedCategory, settings.pexels_api_key)
}

export async function applyRecipeImageCandidateAction(
  recipeId: string,
  imageUrl: string
): Promise<string> {
  const parsedRecipeId = recipeIdSchema.parse(recipeId)
  const parsedImageUrl = imageUrlSchema.parse(imageUrl)
  const storedUrl = await downloadImageToLocalStorage(parsedImageUrl, parsedRecipeId)
  await patchRecipe(parsedRecipeId, { image_url: storedUrl })
  revalidateApp()
  return storedUrl
}

export async function findRecipeImageAction(input: FindRecipeImageInput): Promise<ResolvedRecipeImage | null> {
  const settings = await getSettings()
  const parsedInput = findRecipeImageInputSchema.parse(input)
  const candidates = await collectImageCandidates(parsedInput.title, parsedInput.category, settings.pexels_api_key)
  const candidate = candidates[0]
  if (!candidate) {
    return null
  }

  return {
    imageUrl: candidate.url,
    source: candidate.source,
    creditName: candidate.creditName,
    creditUrl: candidate.creditUrl,
  }
}

export async function extractFromUrlAction(url: string) {
  const settings = await getSettings()

  const normalizedUrl = url.trim()
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    throw new Error('URL must start with http:// or https://')
  }

  let fetchResult: { content: string; imageUrl: string | null; structuredRecipe: { title: string; ingredients: string[]; instructions: string; prep_time: number | null; cook_time: number | null; servings: number | null; category: import('@/types').RecipeCategory; difficulty: import('@/types').Difficulty; confidence: number } | null }
  try {
    fetchResult = await fetchRecipeUrl(normalizedUrl)
  } catch (err) {
    console.error('fetchRecipeUrl error:', err)
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch URL.')
  }

  const { content, imageUrl, structuredRecipe } = fetchResult
  let recipe = structuredRecipe

  if (!recipe) {
    if (!settings.opencode_api_key) {
      throw new Error('OpenCode API-Key fehlt. Bitte im Profil hinterlegen.')
    }

    const baseUrl = resolveAiBaseUrl(settings.opencode_base_url ?? undefined)
    try {
      recipe = await extractRecipeFromText(
        content,
        settings.opencode_api_key,
        baseUrl,
        settings.opencode_model_id ?? undefined,
        true
      )
    } catch (err) {
      console.error('extractRecipeFromText error:', err)
      throw new Error(err instanceof Error ? err.message : 'AI extraction failed.')
    }
  }

  return {
    ...recipe,
    image_url: imageUrl,
    remote_image_url: imageUrl,
    source_url: normalizedUrl,
    source_type: 'url' as const,
  }
}

export async function extractFromImageAction(imageDataUrl: string) {
  const settings = await getSettings()
  if (!settings.gemini_api_key) {
    throw new Error('Gemini API-Key fehlt. Bitte im Profil hinterlegen.')
  }

  if (!imageDataUrl) {
    throw new Error('No image payload provided')
  }

  const recipe = await extractRecipeFromImage(
    imageDataUrl,
    settings.gemini_api_key,
    settings.gemini_base_url ?? undefined,
    settings.gemini_model_id ?? undefined,
    settings.gemini_fallback_model_id ?? undefined
  )

  return {
    ...recipe,
    source_type: 'image' as const,
  }
}
