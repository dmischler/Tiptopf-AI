'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { exportStoreJson, getSettings, importStoreJson, updateSettings } from '@/lib/local/store'

const optionalTrimmedStringSchema = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length > 0 ? value : null))

const settingsInputSchema = z.object({
  opencode_api_key: optionalTrimmedStringSchema,
  opencode_base_url: optionalTrimmedStringSchema,
  opencode_model_id: optionalTrimmedStringSchema,
  gemini_api_key: optionalTrimmedStringSchema,
  gemini_base_url: optionalTrimmedStringSchema,
  gemini_model_id: optionalTrimmedStringSchema,
  gemini_fallback_model_id: optionalTrimmedStringSchema,
  pexels_api_key: optionalTrimmedStringSchema,
})

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value === 'string') {
    return value
  }

  return ''
}

export async function getSettingsAction() {
  return getSettings()
}

export async function exportStoreAction() {
  return exportStoreJson()
}

export async function importStoreAction(jsonText: string) {
  await importStoreJson(jsonText)
  revalidatePath('/library')
  revalidatePath('/collections')
  revalidatePath('/profile')
}

export async function updateSettingsAction(formData: FormData) {
  const parsed = settingsInputSchema.parse({
    opencode_api_key: readFormValue(formData, 'opencode_api_key'),
    opencode_base_url: readFormValue(formData, 'opencode_base_url'),
    opencode_model_id: readFormValue(formData, 'opencode_model_id'),
    gemini_api_key: readFormValue(formData, 'gemini_api_key'),
    gemini_base_url: readFormValue(formData, 'gemini_base_url'),
    gemini_model_id: readFormValue(formData, 'gemini_model_id'),
    gemini_fallback_model_id: readFormValue(formData, 'gemini_fallback_model_id'),
    pexels_api_key: readFormValue(formData, 'pexels_api_key'),
  })

  const nextSettings = await updateSettings(parsed)
  revalidatePath('/profile')
  return nextSettings
}
