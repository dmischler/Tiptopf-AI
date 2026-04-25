'use server'

import { streamText } from 'ai'
import { z } from 'zod'
import { createOpenAI } from '@ai-sdk/openai'

import {
  resolveAiBaseUrl,
  resolveAiImageFallbackModelId,
  resolveAiImageModelId,
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
  confidence: z.number().min(0).max(1),
})

function cleanJsonResponse(raw: string) {
  return raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
}

async function runImageExtraction(
  imageBase64: string,
  apiKey: string,
  baseUrl: string,
  modelId: string
): Promise<string> {
  const ai = createOpenAI({
    apiKey,
    baseURL: baseUrl,
  })

  const result = await streamText({
    model: ai(modelId) as any,
    system: IMAGE_EXTRACTION_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            image: imageBase64,
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
  imageBase64: string,
  apiKey: string,
  baseUrl?: string
): Promise<ParsedRecipe> {
  const resolvedBaseUrl = resolveAiBaseUrl(baseUrl)
  const primaryModel = resolveAiImageModelId()
  const fallbackModel = resolveAiImageFallbackModelId()

  let raw = ''
  let usedModel = primaryModel

  try {
    console.log('AI image extraction - trying primary model:', primaryModel)
    raw = await runImageExtraction(imageBase64, apiKey, resolvedBaseUrl, primaryModel)
  } catch (primaryError) {
    console.error('AI image extraction - primary model failed:', primaryError)
    console.log('AI image extraction - trying fallback model:', fallbackModel)
    raw = await runImageExtraction(imageBase64, apiKey, resolvedBaseUrl, fallbackModel)
    usedModel = fallbackModel
  }

  console.log('AI image extraction - succeeded with model:', usedModel)

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
    image_url: null,
    source_type: 'image',
  }
}
