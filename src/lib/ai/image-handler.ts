'use server'

import { generateText } from 'ai'
import { z } from 'zod'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

import {
  resolveGeminiBaseUrl,
  resolveGeminiImageFallbackModelId,
  resolveGeminiImageModelId,
} from '@/lib/ai/client'
import { IMAGE_EXTRACTION_PROMPT } from '@/lib/ai/prompts'
import type { ParsedRecipe } from '@/types'

const recipeSchema = z.object({
  title: z.string().min(1, 'Titel fehlt im extrahierten Rezept.'),
  ingredients: z.array(z.string()).min(1, 'Zutatenliste fehlt im extrahierten Rezept.'),
  instructions: z.string().min(1, 'Zubereitung fehlt im extrahierten Rezept.'),
  prepTime: z.number().int().nullable(),
  cookTime: z.number().int().nullable(),
  servings: z.number().int().nullable(),
  category: z.enum(['starter', 'main', 'dessert', 'side', 'breakfast', 'snack']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  tags: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
})

function cleanJsonResponse(raw: string) {
  return raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
}

async function runImageExtraction(imageDataUrl: string, model: any): Promise<string> {
  const result = await generateText({
    model,
    system: IMAGE_EXTRACTION_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            image: imageDataUrl,
          },
          {
            type: 'text',
            text: 'Extract recipe content and return valid JSON only.',
          },
        ],
      },
    ],
  })

  return result.text
}

export async function extractRecipeFromImage(
  imageDataUrl: string,
  geminiApiKey: string,
  geminiBaseUrl?: string,
  geminiImageModelId?: string,
  geminiImageFallbackModelId?: string
): Promise<ParsedRecipe> {
  const sanitizedKey = geminiApiKey.trim()
  if (!sanitizedKey) {
    throw new Error('Gemini API-Key fehlt. Bitte im Profil hinterlegen.')
  }

  const googleOptions: { apiKey: string; baseURL?: string } = { apiKey: sanitizedKey }
  const resolvedBaseUrl = resolveGeminiBaseUrl(geminiBaseUrl)
  if (resolvedBaseUrl) {
    googleOptions.baseURL = resolvedBaseUrl
  }

  const google = createGoogleGenerativeAI(googleOptions)
  const primaryModel = resolveGeminiImageModelId(geminiImageModelId)
  const fallbackModel = resolveGeminiImageFallbackModelId(geminiImageFallbackModelId)

  let raw = ''
  let usedModel = primaryModel

  try {
    raw = await runImageExtraction(imageDataUrl, google(primaryModel))
  } catch (primaryError) {
    console.error('AI image extraction - Gemini model failed:', primaryError)
    if (fallbackModel !== primaryModel) {
      raw = await runImageExtraction(imageDataUrl, google(fallbackModel))
      usedModel = fallbackModel
    } else {
      throw primaryError
    }
  }

  console.log('AI image extraction - succeeded with Gemini model:', usedModel)
  console.log('AI image extraction - raw response length:', raw.length)

  const cleaned = cleanJsonResponse(raw)
  if (!cleaned) {
    console.error('AI image extraction failed - empty response. Full raw:', raw)
    throw new Error('Empty response from Gemini. Check API key and model.')
  }

  let parsed
  try {
    parsed = recipeSchema.parse(JSON.parse(cleaned))
  } catch (parseError) {
    if (parseError instanceof z.ZodError) {
      const issues = parseError.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
      throw new Error(`Rezept konnte nicht vollständig erkannt werden (${issues}). Bitte versuche es mit einem anderen Foto.`)
    }
    throw parseError
  }

  return {
    title: parsed.title,
    ingredients: parsed.ingredients,
    instructions: parsed.instructions,
    prep_time: parsed.prepTime,
    cook_time: parsed.cookTime,
    servings: parsed.servings,
    category: parsed.category,
    difficulty: parsed.difficulty,
    confidence: parsed.confidence,
    tags: parsed.tags,
    image_url: null,
    source_type: 'image',
  }
}
