'use server'

import { z } from 'zod'

import { revalidateApp } from '@/app/actions/_revalidate'
import { assertAccess } from '@/lib/access-pin'
import { extractRecipeFromText } from '@/lib/ai/extractor'
import { searchPexelsImages } from '@/lib/ai/image-search'
import { searchMealDbImages } from '@/lib/ai/meal-db'
import type { RecipeImageCandidate, ResolvedRecipeImage } from '@/lib/ai/image-types'
import { assertSafeAiBaseUrl } from '@/lib/ai/assert-base-url'
import { resolveAiBaseUrl, resolveGeminiBaseUrl } from '@/lib/ai/client'
import { extractRecipeFromImage } from '@/lib/ai/image-handler'
import { buildModelBundle, fetchRecipeUrl } from '@/lib/ai/url-fetcher'
import { assertExtractRateLimit } from '@/lib/extract-rate-limit'
import { UnsafeUrlError } from '@/lib/http/safe-fetch'
import { downloadImageToLocalStorage } from '@/lib/local/images'
import { getSettings, patchRecipe } from '@/lib/local/store'
import { categorySchema, recipeIdSchema } from '@/lib/recipe-schema'
import { formatSafeError } from '@/lib/safe-error'
import type { ParsedRecipe, RecipeCategory } from '@/types'

const titleSchema = z.string().trim().min(1).max(180)
const imageUrlSchema = z.string().url().max(2048)
const extractUrlSchema = z.string().url().max(2048)

const ALLOWED_EXTRACT_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const MAX_EXTRACT_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_EXTRACT_DATA_URL_CHARS = 12 * 1024 * 1024

const findRecipeImageInputSchema = z.object({
  title: titleSchema,
  category: categorySchema,
  ingredients: z.array(z.string()).default([]),
})

type FindRecipeImageInput = z.infer<typeof findRecipeImageInputSchema>

function mapZodErrorToGerman(error: z.ZodError, fallback: string): string {
  const issue = error.issues[0]
  if (!issue) {
    return fallback
  }

  switch (issue.code) {
    case 'invalid_string': {
      const validation = 'validation' in issue ? issue.validation : undefined
      if (validation === 'url') return 'URL nicht erlaubt'
      if (validation === 'uuid') return 'Ungültige ID.'
      break
    }
    case 'too_big':
      return 'Eingabe ist zu lang.'
    case 'too_small':
      return 'Eingabe fehlt oder ist zu kurz.'
    case 'invalid_enum_value':
      return 'Ungültiger Wert.'
    default:
      break
  }

  const message = issue.message
  if (message && message !== 'Required' && !message.startsWith('Expected') && !message.startsWith('Invalid')) {
    return message
  }

  return fallback
}

function parseWithGerman<T>(schema: z.ZodType<T>, value: unknown, fallback: string): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new Error(mapZodErrorToGerman(result.error, fallback))
  }
  return result.data
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

async function assertConfiguredAiBaseUrl(value: string | null | undefined, resolve: (input?: string) => string | undefined) {
  if (!value?.trim()) {
    return
  }

  const resolved = resolve(value)
  if (!resolved) {
    return
  }

  try {
    await assertSafeAiBaseUrl(resolved)
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      throw new Error('Base URL nicht erlaubt')
    }
    throw error
  }
}

function parseExtractImageDataUrl(imageDataUrl: string) {
  if (typeof imageDataUrl !== 'string' || imageDataUrl.length === 0) {
    throw new Error('Kein Bild übergeben.')
  }

  if (imageDataUrl.length > MAX_EXTRACT_DATA_URL_CHARS) {
    throw new Error('Bild ist zu groß.')
  }

  const match = imageDataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/i)
  if (!match) {
    throw new Error('Ungültiges Bildformat.')
  }

  const mime = match[1].trim().toLowerCase()
  if (!ALLOWED_EXTRACT_IMAGE_TYPES.has(mime)) {
    throw new Error('Nur JPG, PNG und WEBP sind erlaubt.')
  }

  const decoded = Buffer.from(match[2], 'base64')
  if (decoded.byteLength === 0 || decoded.byteLength > MAX_EXTRACT_IMAGE_BYTES) {
    throw new Error('Bild ist zu groß.')
  }

  return imageDataUrl
}

export async function searchRecipeImageCandidatesAction(
  title: string,
  category: RecipeCategory
): Promise<RecipeImageCandidate[]> {
  await assertAccess()
  const settings = await getSettings()
  const parsedTitle = parseWithGerman(titleSchema, title, 'Titel fehlt oder ist ungültig.')
  const parsedCategory = parseWithGerman(categorySchema, category, 'Ungültige Kategorie.')
  return collectImageCandidates(parsedTitle, parsedCategory, settings.pexels_api_key)
}

export async function applyRecipeImageCandidateAction(
  recipeId: string,
  imageUrl: string
): Promise<string> {
  await assertAccess()
  const parsedRecipeId = parseWithGerman(recipeIdSchema, recipeId, 'Ungültige Rezept-ID.')
  const parsedImageUrl = parseWithGerman(imageUrlSchema, imageUrl, 'URL nicht erlaubt')
  try {
    const storedUrl = await downloadImageToLocalStorage(parsedImageUrl, parsedRecipeId)
    await patchRecipe(parsedRecipeId, { image_url: storedUrl })
    revalidateApp()
    return storedUrl
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      throw new Error('URL nicht erlaubt')
    }
    throw error
  }
}

export async function findRecipeImageAction(input: FindRecipeImageInput): Promise<ResolvedRecipeImage | null> {
  await assertAccess()
  const settings = await getSettings()
  const parsedInput = parseWithGerman(findRecipeImageInputSchema, input, 'Ungültige Suchangaben.')
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
  await assertAccess()
  assertExtractRateLimit()

  const normalizedUrl = parseWithGerman(
    extractUrlSchema,
    typeof url === 'string' ? url.trim() : url,
    'URL nicht erlaubt'
  )

  let settings: Awaited<ReturnType<typeof getSettings>>
  let fetchResult: Awaited<ReturnType<typeof fetchRecipeUrl>>
  try {
    ;[settings, fetchResult] = await Promise.all([getSettings(), fetchRecipeUrl(normalizedUrl)])
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      throw new Error('URL nicht erlaubt')
    }
    console.error('fetchRecipeUrl error:', formatSafeError(err))
    throw new Error(err instanceof Error ? err.message : 'URL konnte nicht geladen werden.')
  }

  await assertConfiguredAiBaseUrl(settings.opencode_base_url, resolveAiBaseUrl)

  let recipe: ParsedRecipe
  let untranslated = false

  if (settings.opencode_api_key) {
    const bundle = buildModelBundle(fetchResult)
    if (!bundle.trim()) {
      throw new Error('Auf der Seite wurde kein Rezeptinhalt gefunden.')
    }

    try {
      recipe = await extractRecipeFromText(
        bundle,
        settings.opencode_api_key,
        resolveAiBaseUrl(settings.opencode_base_url ?? undefined),
        settings.opencode_model_id ?? undefined
      )
    } catch (err) {
      console.error('extractRecipeFromText error:', formatSafeError(err))
      throw new Error(err instanceof Error ? err.message : 'AI-Extraktion fehlgeschlagen.')
    }
  } else if (fetchResult.structuredRecipe) {
    recipe = {
      ...fetchResult.structuredRecipe,
      source_type: 'url',
    }
    untranslated = true
  } else {
    throw new Error('OpenCode API-Key fehlt. Bitte im Profil hinterlegen.')
  }

  return {
    ...recipe,
    image_url: fetchResult.imageUrl,
    remote_image_url: fetchResult.imageUrl,
    source_url: normalizedUrl,
    source_type: 'url' as const,
    untranslated,
  }
}

export async function extractFromImageAction(imageDataUrl: string) {
  await assertAccess()
  assertExtractRateLimit()
  const settings = await getSettings()
  if (!settings.gemini_api_key) {
    throw new Error('Gemini API-Key fehlt. Bitte im Profil hinterlegen.')
  }

  const parsedImage = parseExtractImageDataUrl(imageDataUrl)
  await assertConfiguredAiBaseUrl(settings.gemini_base_url, (value) => resolveGeminiBaseUrl(value) ?? undefined)

  const recipe = await extractRecipeFromImage(
    parsedImage,
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
