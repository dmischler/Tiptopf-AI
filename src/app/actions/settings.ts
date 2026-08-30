'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertAccess } from '@/lib/access-pin'
import { assertSafeAiBaseUrl } from '@/lib/ai/assert-base-url'
import { resolveAiBaseUrl, resolveGeminiBaseUrl } from '@/lib/ai/client'
import { UnsafeUrlError } from '@/lib/http/safe-fetch'
import { exportStoreJson, getSettings, importStoreJson, updateSettings } from '@/lib/local/store'

const MAX_IMPORT_JSON_CHARS = 5 * 1024 * 1024

const optionalTrimmedStringSchema = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length > 0 ? value : null))

const settingsInputSchema = z.object({
  opencode_base_url: optionalTrimmedStringSchema,
  opencode_model_id: optionalTrimmedStringSchema,
  gemini_base_url: optionalTrimmedStringSchema,
  gemini_model_id: optionalTrimmedStringSchema,
  gemini_fallback_model_id: optionalTrimmedStringSchema,
})

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value === 'string') {
    return value
  }

  return ''
}

function isChecked(formData: FormData, key: string) {
  const value = formData.get(key)
  return value === 'on' || value === 'true' || value === '1'
}

function readSecretPatch(formData: FormData, field: string, clearField: string): string | null | undefined {
  if (isChecked(formData, clearField)) {
    return null
  }

  const raw = readFormValue(formData, field).trim()
  if (!raw) {
    return undefined
  }

  return raw
}

async function validateOptionalBaseUrl(value: string | null, resolve: (input?: string) => string | undefined) {
  if (!value) {
    return
  }

  const resolved = resolve(value)
  if (!resolved) {
    return
  }

  try {
    await assertSafeAiBaseUrl(resolved)
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      throw new Error('Base URL nicht erlaubt')
    }
    throw error
  }
}

export async function getSettingsAction() {
  await assertAccess()
  return getSettings()
}

export async function exportStoreAction(options?: { includeSecrets?: boolean }) {
  await assertAccess()
  return exportStoreJson({ includeSecrets: options?.includeSecrets === true })
}

export async function importStoreAction(jsonText: string, options?: { includeSecrets?: boolean }) {
  await assertAccess()
  if (typeof jsonText !== 'string' || jsonText.length > MAX_IMPORT_JSON_CHARS) {
    throw new Error('Backup ist zu groß (max. 5 MB).')
  }

  await importStoreJson(jsonText, { includeSecrets: options?.includeSecrets === true })
  revalidatePath('/library')
  revalidatePath('/collections')
  revalidatePath('/profile')
}

export async function updateSettingsAction(formData: FormData) {
  await assertAccess()
  const parsed = settingsInputSchema.parse({
    opencode_base_url: readFormValue(formData, 'opencode_base_url'),
    opencode_model_id: readFormValue(formData, 'opencode_model_id'),
    gemini_base_url: readFormValue(formData, 'gemini_base_url'),
    gemini_model_id: readFormValue(formData, 'gemini_model_id'),
    gemini_fallback_model_id: readFormValue(formData, 'gemini_fallback_model_id'),
  })

  await validateOptionalBaseUrl(parsed.opencode_base_url, resolveAiBaseUrl)
  await validateOptionalBaseUrl(parsed.gemini_base_url, (value) => resolveGeminiBaseUrl(value) ?? undefined)

  const patch: {
    opencode_api_key?: string | null
    opencode_base_url: string | null
    opencode_model_id: string | null
    gemini_api_key?: string | null
    gemini_base_url: string | null
    gemini_model_id: string | null
    gemini_fallback_model_id: string | null
    pexels_api_key?: string | null
  } = {
    opencode_base_url: parsed.opencode_base_url,
    opencode_model_id: parsed.opencode_model_id,
    gemini_base_url: parsed.gemini_base_url,
    gemini_model_id: parsed.gemini_model_id,
    gemini_fallback_model_id: parsed.gemini_fallback_model_id,
  }

  const opencodeKey = readSecretPatch(formData, 'opencode_api_key', 'clear_opencode_api_key')
  if (opencodeKey !== undefined) {
    patch.opencode_api_key = opencodeKey
  }

  const geminiKey = readSecretPatch(formData, 'gemini_api_key', 'clear_gemini_api_key')
  if (geminiKey !== undefined) {
    patch.gemini_api_key = geminiKey
  }

  const pexelsKey = readSecretPatch(formData, 'pexels_api_key', 'clear_pexels_api_key')
  if (pexelsKey !== undefined) {
    patch.pexels_api_key = pexelsKey
  }

  await updateSettings(patch)
  revalidatePath('/profile')
}
