'use server'

import { generateObject } from 'ai'
import { z } from 'zod'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

import {
  resolveGeminiBaseUrl,
  resolveGeminiImageFallbackModelId,
  resolveGeminiImageModelId,
} from '@/lib/ai/client'
import { SIMPLIFIED_IMAGE_PROMPT } from '@/lib/ai/prompts'
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

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]*);base64,(.+)$/)
  if (!match) return null
  const mimeType = match[1]?.trim() || 'image/jpeg'
  return { mimeType, base64: match[2] }
}

function getFinishReasonString(finishReason: unknown): string {
  if (typeof finishReason === 'string') return finishReason
  if (finishReason && typeof finishReason === 'object') {
    const fr = finishReason as { unified?: string; raw?: string }
    return fr.unified || fr.raw || String(finishReason)
  }
  return String(finishReason || '')
}

type ExtractionResult = {
  text: string
  finishReason: string
}

async function runImageExtraction(imageDataUrl: string, model: any): Promise<ExtractionResult> {
  const parsedImage = parseDataUrl(imageDataUrl)
  if (!parsedImage) {
    throw new Error('Invalid image data URL format')
  }

  const imageDataUrlFull = `data:${parsedImage.mimeType};base64,${parsedImage.base64}`

  const result = await generateObject({
    model,
    schema: recipeSchema,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: SIMPLIFIED_IMAGE_PROMPT,
          },
          {
            type: 'image',
            image: imageDataUrlFull,
          },
        ],
      },
    ],
    providerOptions: {
      google: {
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      },
    },
    maxTokens: 2000,
    temperature: 0.2,
  } as any)

  return {
    text: JSON.stringify(result.object),
    finishReason: 'stop',
  }
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

  const hardcodedFallbacks = [
    'gemini-2.5-flash',
    'gemini-3.1-flash-lite-preview',
  ]

  const modelsToTry = [
    primaryModel,
    ...(fallbackModel !== primaryModel ? [fallbackModel] : []),
    ...hardcodedFallbacks.filter((m) => m !== primaryModel && m !== fallbackModel),
  ]

  let raw = ''
  let usedModel = primaryModel
  let finishReason = ''

  async function tryExtract(modelName: string): Promise<boolean> {
    console.log('AI image extraction - trying Gemini model:', modelName)
    try {
      const result = await runImageExtraction(imageDataUrl, google(modelName))
      raw = result.text
      finishReason = result.finishReason
      console.log(
        'AI image extraction - model:',
        modelName,
        'finishReason:',
        finishReason,
        'textLength:',
        raw.length
      )
      return raw.trim().length > 0
    } catch (err) {
      console.error('AI image extraction - Gemini model failed:', modelName, err)
      return false
    }
  }

  let success = false
  for (const modelName of modelsToTry) {
    success = await tryExtract(modelName)
    if (success) {
      usedModel = modelName
      break
    }
  }

  if (!success) {
    console.error(
      'AI image extraction failed - all models returned empty. Last finishReason:',
      finishReason
    )
    const isSafetyBlock = finishReason?.toLowerCase().includes('safety') || finishReason?.toLowerCase().includes('block')
    throw new Error(
      isSafetyBlock
        ? 'Das Bild wurde von der Google-Sicherheitsfilterung blockiert. Bitte versuche ein anderes Foto.'
        : 'Keine Antwort von Gemini erhalten. Überprüfe API-Key und Modell-Einstellungen (z. B. gemini-2.0-flash).'
    )
  }

  console.log('AI image extraction - succeeded with Gemini model:', usedModel)

  let parsed
  try {
    parsed = recipeSchema.parse(JSON.parse(cleanJsonResponse(raw)))
  } catch (parseError) {
    if (parseError instanceof z.ZodError) {
      const issues = parseError.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
      throw new Error(
        `Rezept konnte nicht vollständig erkannt werden (${issues}). Bitte versuche es mit einem anderen Foto.`
      )
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
