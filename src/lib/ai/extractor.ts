'use server'

import { streamText } from 'ai'
import { z } from 'zod'
import { createOpenAI } from '@ai-sdk/openai'

import type { ParsedRecipe } from '@/types'
import { resolveAiBaseUrl, resolveAiModelId } from '@/lib/ai/client'
import { IMAGE_EXTRACTION_PROMPT, URL_EXTRACTION_PROMPT } from '@/lib/ai/prompts'

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

type RecipeSchema = z.infer<typeof recipeSchema>

function normalizeParsedRecipe(recipe: RecipeSchema, sourceType: 'image' | 'url'): ParsedRecipe {
  return {
    title: recipe.title,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    prep_time: recipe.prepTime,
    cook_time: recipe.cookTime,
    servings: recipe.servings,
    category: recipe.category,
    difficulty: recipe.difficulty,
    confidence: recipe.confidence,
    source_type: sourceType,
  }
}

function cleanJsonResponse(raw: string) {
  return raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
}

async function runExtraction(
  content: string,
  systemPrompt: string,
  apiKey: string,
  baseUrl?: string
) {
  const ai = createOpenAI({
    apiKey,
    baseURL: resolveAiBaseUrl(baseUrl),
  })

  const result = await streamText({
    model: ai(resolveAiModelId()) as any,
    system: systemPrompt,
    prompt: content,
  })

  let raw = ''
  for await (const chunk of result.textStream) {
    raw += chunk
  }

  const parsed = recipeSchema.parse(JSON.parse(cleanJsonResponse(raw)))
  return parsed
}

export async function extractRecipeFromText(
  text: string,
  apiKey: string,
  baseUrl?: string,
  isUrl = false
): Promise<ParsedRecipe> {
  const parsed = await runExtraction(
    text,
    isUrl ? URL_EXTRACTION_PROMPT : IMAGE_EXTRACTION_PROMPT,
    apiKey,
    baseUrl
  )

  return normalizeParsedRecipe(parsed, isUrl ? 'url' : 'image')
}

export async function streamRecipeExtraction(
  text: string,
  apiKey: string,
  baseUrl?: string,
  isUrl = false
) {
  const ai = createOpenAI({
    apiKey,
    baseURL: resolveAiBaseUrl(baseUrl),
  })

  const result = await streamText({
    model: ai(resolveAiModelId()) as any,
    system: isUrl ? URL_EXTRACTION_PROMPT : IMAGE_EXTRACTION_PROMPT,
    prompt: text,
  })

  return result.toTextStreamResponse()
}
