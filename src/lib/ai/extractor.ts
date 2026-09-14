import {
  APICallError,
  generateObject,
  NoObjectGeneratedError,
  type LanguageModel,
  type ModelMessage,
} from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { z } from 'zod'

import {
  resolveAiBaseUrl,
  resolveAiModelId,
  resolveGeminiBaseUrl,
  resolveGeminiFallbackModelId,
  resolveGeminiModelId,
} from '@/lib/ai/client'
import { URL_EXTRACTION_PROMPT } from '@/lib/ai/prompts'
import { aiRecipeSchema, toParsedRecipe, type AiRecipe } from '@/lib/ai/recipe-schema'
import { formatSafeError } from '@/lib/safe-error'
import type { ParsedRecipe } from '@/types'

type StructuredExtractionInput = {
  model: LanguageModel
  system?: string
  maxOutputTokens?: number
  temperature?: number
  providerOptions?: NonNullable<Parameters<typeof generateObject>[0]>['providerOptions']
} & ({ prompt: string; messages?: never } | { messages: ModelMessage[]; prompt?: never })

async function repairJsonFences({ text }: { text: string }): Promise<string | null> {
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  cleaned = cleaned.replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  if (!cleaned || cleaned === text.trim()) {
    return null
  }
  return cleaned
}

function logExtractionFailure(err: unknown) {
  if (NoObjectGeneratedError.isInstance(err)) {
    const text = err.text ?? ''
    console.error('AI extraction parse failed', {
      length: text.length,
      preview: text.slice(0, 200),
      finishReason: err.finishReason ?? null,
    })
    return
  }

  console.error('AI extraction failed:', formatSafeError(err))
}

export function isOpenCodeFreeTierRestriction(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  return (
    message.includes('free tier can only be used in opencode') ||
    message.includes('only be used in opencode')
  )
}

function mapOpenCodeError(err: unknown): Error {
  if (isOpenCodeFreeTierRestriction(err)) {
    return new Error(
      'OpenCode Free-Tier funktioniert nur in OpenCode selbst. Bitte OpenCode Go im Profil einrichten oder Gemini für URL-Erkennung nutzen.'
    )
  }

  if (APICallError.isInstance(err)) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      return new Error('OpenCode API-Key ungültig. Bitte im Profil prüfen.')
    }
    if (err.statusCode === 429) {
      return new Error('OpenCode-Kontingent erschöpft. Bitte später erneut versuchen.')
    }
  }

  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  if (
    message.includes('unauthorized') ||
    message.includes('invalid api key') ||
    message.includes('api key not valid') ||
    /\b401\b/.test(message)
  ) {
    return new Error('OpenCode API-Key ungültig. Bitte im Profil prüfen.')
  }
  if (message.includes('quota') || message.includes('rate limit') || message.includes('resource exhausted')) {
    return new Error('OpenCode-Kontingent erschöpft. Bitte später erneut versuchen.')
  }
  if (NoObjectGeneratedError.isInstance(err) || err instanceof z.ZodError) {
    return new Error('Rezept konnte nicht aus der Seite erkannt werden. Bitte versuche eine andere URL.')
  }

  return new Error('AI-Extraktion fehlgeschlagen.')
}

function mapGeminiTextError(err: unknown): Error {
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
  if (message.includes('quota') || message.includes('rate limit') || message.includes('resource exhausted')) {
    return new Error('Gemini-Kontingent erschöpft. Bitte später erneut versuchen.')
  }
  if (NoObjectGeneratedError.isInstance(err) || err instanceof z.ZodError) {
    return new Error('Rezept konnte nicht aus der Seite erkannt werden. Bitte versuche eine andere URL.')
  }

  return new Error('Gemini-Extraktion fehlgeschlagen.')
}

export async function runStructuredExtraction(input: StructuredExtractionInput): Promise<AiRecipe> {
  const shared = {
    model: input.model,
    schema: aiRecipeSchema,
    system: input.system,
    maxOutputTokens: input.maxOutputTokens,
    temperature: input.temperature,
    providerOptions: input.providerOptions,
    experimental_repairText: repairJsonFences,
  }

  try {
    const result = input.messages
      ? await generateObject({
          ...shared,
          messages: input.messages,
        })
      : await generateObject({
          ...shared,
          prompt: input.prompt,
        })

    return result.object
  } catch (err) {
    logExtractionFailure(err)
    throw err
  }
}

export async function extractRecipeFromText(
  text: string,
  apiKey: string,
  baseUrl?: string,
  modelId?: string
): Promise<ParsedRecipe> {
  const content = text.trim()
  if (!content) {
    throw new Error('Auf der Seite wurde kein Rezeptinhalt gefunden.')
  }

  const resolvedBaseUrl = resolveAiBaseUrl(baseUrl)
  const resolvedModelId = resolveAiModelId(modelId)

  const provider = createOpenAICompatible({
    name: 'opencode',
    apiKey,
    baseURL: resolvedBaseUrl,
  })

  try {
    const parsed = await runStructuredExtraction({
      model: provider(resolvedModelId),
      system: URL_EXTRACTION_PROMPT,
      prompt: content,
    })
    return toParsedRecipe(parsed, 'url')
  } catch (err) {
    throw mapOpenCodeError(err)
  }
}

export async function extractRecipeFromTextWithGemini(
  text: string,
  apiKey: string,
  baseUrl?: string,
  modelId?: string,
  fallbackModelId?: string
): Promise<ParsedRecipe> {
  const content = text.trim()
  if (!content) {
    throw new Error('Auf der Seite wurde kein Rezeptinhalt gefunden.')
  }

  const sanitizedKey = apiKey.trim()
  if (!sanitizedKey) {
    throw new Error('Gemini API-Key fehlt. Bitte im Profil hinterlegen.')
  }

  const googleOptions: { apiKey: string; baseURL?: string } = { apiKey: sanitizedKey }
  const resolvedBaseUrl = resolveGeminiBaseUrl(baseUrl)
  if (resolvedBaseUrl) {
    googleOptions.baseURL = resolvedBaseUrl
  }

  const google = createGoogleGenerativeAI(googleOptions)
  const primaryModel = resolveGeminiModelId(modelId)
  const fallbackModel = resolveGeminiFallbackModelId(fallbackModelId)
  const modelsToTry = [primaryModel, ...(fallbackModel !== primaryModel ? [fallbackModel] : [])]

  let lastError: unknown
  for (const name of modelsToTry) {
    try {
      const parsed = await runStructuredExtraction({
        model: google(name),
        system: URL_EXTRACTION_PROMPT,
        prompt: content,
      })
      return toParsedRecipe(parsed, 'url')
    } catch (err) {
      lastError = err
      console.error('Gemini URL extraction failed:', name, formatSafeError(err))
    }
  }

  throw mapGeminiTextError(lastError)
}
