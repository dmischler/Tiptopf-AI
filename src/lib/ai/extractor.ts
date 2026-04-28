import { generateText } from 'ai'
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
  tags: z.array(z.string()).optional(),
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
    tags: recipe.tags,
    source_type: sourceType,
  }
}

function cleanJsonResponse(raw: string) {
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  cleaned = cleaned.replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  return cleaned
}

async function runExtraction(
  content: string,
  systemPrompt: string,
  apiKey: string,
  baseUrl?: string,
  modelId?: string
) {
  const resolvedBaseUrl = resolveAiBaseUrl(baseUrl)
  const resolvedModelId = resolveAiModelId(modelId)

  const ai = createOpenAI({
    apiKey,
    baseURL: resolvedBaseUrl,
  })

  let raw = ''
  try {
    const result = await generateText({
      model: ai(resolvedModelId) as any,
      system: systemPrompt,
      prompt: content,
    })
    raw = result.text
  } catch (err) {
    console.error('generateText error:', err)
    throw err
  }

  const cleaned = cleanJsonResponse(raw)
  if (!cleaned) {
    console.error('AI extraction failed - empty response. Full raw:', raw)
    throw new Error('Empty response from AI. Check API key and model.')
  }
  try {
    const parsed = recipeSchema.parse(JSON.parse(cleaned))
    return parsed
  } catch (parseError) {
    console.error('JSON parse error:', parseError)
    console.error('Raw response:', raw)
    console.error('Cleaned response:', cleaned)
    throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`)
  }
}

export async function extractRecipeFromText(
  text: string,
  apiKey: string,
  baseUrl?: string,
  modelId?: string,
  isUrl = false
): Promise<ParsedRecipe> {
  const parsed = await runExtraction(
    text,
    isUrl ? URL_EXTRACTION_PROMPT : IMAGE_EXTRACTION_PROMPT,
    apiKey,
    baseUrl,
    modelId
  )

  return normalizeParsedRecipe(parsed, isUrl ? 'url' : 'image')
}
