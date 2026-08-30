import { TRUSTED_AI_HOSTS } from '@/lib/ai/client'
import { assertSafeHttpUrl, UnsafeUrlError } from '@/lib/http/safe-fetch'

export async function assertSafeAiBaseUrl(baseUrl: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    throw new UnsafeUrlError('Base URL nicht erlaubt')
  }

  const host = parsed.hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost')) {
    throw new UnsafeUrlError('Base URL nicht erlaubt')
  }

  if (TRUSTED_AI_HOSTS.has(host)) {
    if (parsed.protocol !== 'https:') {
      throw new UnsafeUrlError('Base URL nicht erlaubt')
    }
    return
  }

  try {
    await assertSafeHttpUrl(baseUrl)
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      throw new UnsafeUrlError('Base URL nicht erlaubt')
    }
    throw error
  }
}
