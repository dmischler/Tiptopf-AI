'use server'

import { streamText } from 'ai'
import { z } from 'zod'
import { createOpenAI } from '@ai-sdk/openai'

import { resolveAiBaseUrl, resolveAiModelId } from '@/lib/ai/client'
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

export async function extractRecipeFromImage(
  imageBase64: string,
  apiKey: string,
  baseUrl?: string
): Promise<ParsedRecipe> {
  const ai = createOpenAI({
    apiKey,
    baseURL: resolveAiBaseUrl(baseUrl),
  })
  const result = await streamText({
    model: ai(resolveAiModelId()) as any,
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
