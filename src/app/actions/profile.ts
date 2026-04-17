'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const saveProfileApiSettingsSchema = z.object({
  encryptedApiKey: z.string().min(1).nullable(),
  apiBaseUrl: z.string().url(),
})

export async function saveProfileApiSettings(input: z.infer<typeof saveProfileApiSettingsSchema>) {
  const parsedInput = saveProfileApiSettingsSchema.parse(input)
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  const updatePayload: {
    api_base_url: string
    encrypted_api_key?: string
  } = {
    api_base_url: parsedInput.apiBaseUrl,
  }

  if (parsedInput.encryptedApiKey) {
    updatePayload.encrypted_api_key = parsedInput.encryptedApiKey
  }

  const { error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', user.id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/profile')
}
