'use server'

import { streamText } from 'ai'
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
  title: z.string().min(1),
  ingredients: z.array(z.string()),
  instructions: z.string().min(1),
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
  const result = await streamText({
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

  let raw = ''
  for await (const chunk of result.textStream) {
    raw += chunk
  }

  return raw
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
    console.log('AI image extraction - trying Gemini model:', primaryModel)
    raw = await runImageExtraction(imageDataUrl, google(primaryModel))
  } catch (primaryError) {
    console.error('AI image extraction - Gemini model failed:', primaryError)
    if (fallbackModel !== primaryModel) {
      console.log('AI image extraction - trying Gemini fallback:', fallbackModel)
      raw = await runImageExtraction(imageDataUrl, google(fallbackModel))
      usedModel = fallbackModel
    } else {
      throw primaryError
    }
  }

  console.log('AI image extraction - succeeded with Gemini model:', usedModel)

  const parsed = recipeSchema.parse(JSON.parse(cleanJsonResponse(raw)))

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
