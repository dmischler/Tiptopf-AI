import { createGoogleGenerativeAI, type GoogleLanguageModelOptions } from '@ai-sdk/google'
import { APICallError, NoObjectGeneratedError, type LanguageModel } from 'ai'
import { z } from 'zod'

import {
  resolveGeminiBaseUrl,
  resolveGeminiFallbackModelId,
  resolveGeminiModelId,
} from '@/lib/ai/client'
import { runStructuredExtraction } from '@/lib/ai/extractor'
import { IMAGE_EXTRACTION_PROMPT } from '@/lib/ai/prompts'
import { toParsedRecipe } from '@/lib/ai/recipe-schema'
import { formatSafeError } from '@/lib/safe-error'
import type { ParsedRecipe } from '@/types'

const ALLOWED_IMAGE_DATA_URL_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  const mimeType = match[1]?.trim().toLowerCase() || ''
  if (!ALLOWED_IMAGE_DATA_URL_TYPES.has(mimeType)) {
    return null
  }
  return {
    mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType,
    bytes: Buffer.from(match[2], 'base64'),
  }
}

function mapGeminiUserError(err: unknown): Error | null {
  if (APICallError.isInstance(err)) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      return new Error('Gemini API-Key ungültig. Bitte im Profil prüfen.')
    }
    if (err.statusCode === 429) {
      return new Error('Gemini-Kontingent erschöpft. Bitte später erneut versuchen.')
    }
  }

  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  if (
    message.includes('unauthorized') ||
    message.includes('invalid api key') ||
    message.includes('api key not valid') ||
    /\b401\b/.test(message)
  ) {
    return new Error('Gemini API-Key ungültig. Bitte im Profil prüfen.')
  }
  if (
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('resource exhausted') ||
    /\b429\b/.test(message)
  ) {
    return new Error('Gemini-Kontingent erschöpft. Bitte später erneut versuchen.')
  }

  const finishReason = NoObjectGeneratedError.isInstance(err) ? err.finishReason : undefined
  if (
    finishReason === 'content-filter' ||
    message.includes('safety') ||
    message.includes('content-filter') ||
    message.includes('blocked by')
  ) {
    return new Error(
      'Das Bild wurde von der Google-Sicherheitsfilterung blockiert. Bitte versuche ein anderes Foto.'
    )
  }

  return null
}

async function runImageExtraction(imageDataUrl: string, model: LanguageModel) {
  const parsedImage = parseDataUrl(imageDataUrl)
  if (!parsedImage) {
    throw new Error('Ungültiges Bildformat.')
  }

  return runStructuredExtraction({
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: IMAGE_EXTRACTION_PROMPT,
          },
          {
            type: 'image',
            image: parsedImage.bytes,
            mediaType: parsedImage.mimeType,
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
      } satisfies GoogleLanguageModelOptions,
    },
    maxOutputTokens: 2000,
    temperature: 0.2,
  })
}

export async function extractRecipeFromImage(
  imageDataUrl: string,
  geminiApiKey: string,
  geminiBaseUrl?: string,
  geminiModelId?: string,
  geminiFallbackModelId?: string
): Promise<ParsedRecipe> {
  const sanitizedKey = geminiApiKey.trim()
  if (!sanitizedKey) {
    throw new Error('Gemini API-Key fehlt. Bitte im Profil hinterlegen.')
  }

  const googleOptions: { apiKey: string; baseURL?: string } = { apiKey: sanitizedKey }

  // Only set custom baseURL if user explicitly configured one (to use the exact same
  // API access point as inflabasket-web when no custom endpoint is desired)
  if (geminiBaseUrl && geminiBaseUrl.trim()) {
    const resolvedBaseUrl = resolveGeminiBaseUrl(geminiBaseUrl)
    if (resolvedBaseUrl) {
      googleOptions.baseURL = resolvedBaseUrl
    }
  }

  const google = createGoogleGenerativeAI(googleOptions)
  const primaryModel = resolveGeminiModelId(geminiModelId)
  const fallbackModel = resolveGeminiFallbackModelId(geminiFallbackModelId)

  // Last-resort if the user's primary and fallback Gemini IDs are unavailable (retired/renamed).
  const hardcodedFallbacks = ['gemini-2.0-flash']

  const modelsToTry = [
    primaryModel,
    ...(fallbackModel !== primaryModel ? [fallbackModel] : []),
    ...hardcodedFallbacks.filter((modelName) => modelName !== primaryModel && modelName !== fallbackModel),
  ]

  let lastAttemptedModel = primaryModel
  let lastError: unknown

  for (const modelName of modelsToTry) {
    lastAttemptedModel = modelName
    try {
      const parsed = await runImageExtraction(imageDataUrl, google(modelName))
      return {
        ...toParsedRecipe(parsed, 'image'),
        image_url: null,
      }
    } catch (err) {
      const mapped = mapGeminiUserError(err)
      if (mapped) {
        throw mapped
      }
      lastError = err
      console.error('AI image extraction - Gemini model failed:', modelName, formatSafeError(err))
    }
  }

  const modelHint = lastAttemptedModel ? ` (letzter Versuch: ${lastAttemptedModel})` : ''
  if (lastError instanceof z.ZodError || NoObjectGeneratedError.isInstance(lastError)) {
    throw new Error(
      'Rezept konnte nicht vollständig erkannt werden. Bitte versuche es mit einem anderen Foto.'
    )
  }

  throw new Error(
    `Keine Antwort von Gemini erhalten${modelHint}. Überprüfe API-Key und Modell-Einstellungen im Profil (z. B. gemini-2.0-flash oder gemini-2.5-flash).`
  )
}
