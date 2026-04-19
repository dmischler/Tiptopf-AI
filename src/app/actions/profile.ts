'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { saveProfileSettings } from '@/lib/local/store'

const saveProfileApiSettingsSchema = z.object({
  encryptedApiKey: z.string().min(1).nullable(),
  apiBaseUrl: z.string().url(),
})

export async function saveProfileApiSettings(input: z.infer<typeof saveProfileApiSettingsSchema>) {
  const parsedInput = saveProfileApiSettingsSchema.parse(input)
  await saveProfileSettings({
    encryptedApiKey: parsedInput.encryptedApiKey,
    apiBaseUrl: parsedInput.apiBaseUrl,
  })

  revalidatePath('/profile')
}
