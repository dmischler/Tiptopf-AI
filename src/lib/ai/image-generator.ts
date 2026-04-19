import { Buffer } from 'node:buffer'

import { z } from 'zod'

import type { RecipeCategory } from '@/types'
import { resolveAiBaseUrl } from '@/lib/ai/client'

const imageGenerationResponseSchema = z.object({
  data: z
    .array(
      z.object({
        url: z.string().url().optional(),
        b64_json: z.string().optional(),
      })
    )
    .min(1),
})

type GenerateRecipeImageWithAiInput = {
  title: string
  category: RecipeCategory
  ingredients: string[]
  apiKey: string
  baseUrl?: string
}

type GeneratedRecipeImage = {
  url: string | null
  bytes: Uint8Array | null
  mimeType: string | null
}

function buildImagePrompt(title: string, category: RecipeCategory, ingredients: string[]) {
  const categoryHints: Record<RecipeCategory, string> = {
    starter: 'stylish starter plated in a modern restaurant style',
    main: 'appetizing main course plated for food photography',
    dessert: 'beautiful dessert plated with elegant garnish',
    side: 'colorful side dish presented attractively',
    breakfast: 'warm breakfast dish in natural daylight',
    snack: 'tempting snack plate with crisp detail',
  }

  const ingredientHint = ingredients
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .slice(0, 7)
    .join(', ')

  return [
    `Professional food photo of ${categoryHints[category]}.`,
    `Dish name: ${title}.`,
    ingredientHint ? `Main ingredients: ${ingredientHint}.` : null,
    'Natural colors, realistic textures, no text, no watermark, no people.',
    '4:3 composition, suitable for a recipe card.',
  ]
    .filter(Boolean)
    .join(' ')
}

function toImageEndpoint(baseUrl?: string) {
  const resolved = resolveAiBaseUrl(baseUrl)
  return new URL('images/generations', resolved.endsWith('/') ? resolved : `${resolved}/`).toString()
}

export async function generateRecipeImageWithAi(
  input: GenerateRecipeImageWithAiInput
): Promise<GeneratedRecipeImage> {
  const response = await fetch(toImageEndpoint(input.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: buildImagePrompt(input.title, input.category, input.ingredients),
      size: '1024x768',
      quality: 'medium',
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`AI image generation failed with status ${response.status}`)
  }

  const parsed = imageGenerationResponseSchema.parse(await response.json())
  const first = parsed.data[0]

  if (first.b64_json) {
    return {
      url: null,
      bytes: Uint8Array.from(Buffer.from(first.b64_json, 'base64')),
      mimeType: 'image/png',
    }
  }

  return {
    url: first.url ?? null,
    bytes: null,
    mimeType: null,
  }
}
