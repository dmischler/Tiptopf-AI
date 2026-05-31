const LEGACY_BASE_URLS = new Set(['https://api.opencode.ai', 'https://api.opencode.ai/v1'])
export const DEFAULT_BASE_URL = 'https://opencode.ai/zen/v1'
export const DEFAULT_MODEL_ID = 'big-pickle'
export const DEFAULT_GEMINI_MODEL_ID = 'gemini-2.5-flash'
export const DEFAULT_GEMINI_FALLBACK_MODEL_ID = 'gemini-2.0-flash'

/**
 * Legacy model ID mappings.
 * Big Pickle (GLM-4.6 via OpenCode Zen) is the current default for recipe extraction.
 * Previously minimax-m2.5(-free) was used; those IDs are still supported via this map.
 */
const LEGACY_MODEL_IDS: Record<string, string> = {
  'minimax-m2.5': 'minimax-m2.5',
  'minimax-m2.5-free': 'minimax-m2.5-free',
  'minimax-m2.7': 'minimax-m2.5',
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function normalizeBaseUrl(value: string) {
  const trimmed = trimTrailingSlash(value.trim())
  if (!trimmed) {
    return ''
  }

  if (trimmed.toLowerCase().endsWith('/chat/completions')) {
    return trimTrailingSlash(trimmed.slice(0, -'/chat/completions'.length))
  }

  return trimmed
}

function normalizeModelId(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return DEFAULT_MODEL_ID
  }

  let withoutPrefix = trimmed

  // Strip common provider prefixes (supports both free Zen and Go subscription)
  if (withoutPrefix.toLowerCase().startsWith('opencode/')) {
    withoutPrefix = withoutPrefix.slice('opencode/'.length)
  } else if (withoutPrefix.toLowerCase().startsWith('opencode-go/')) {
    withoutPrefix = withoutPrefix.slice('opencode-go/'.length)
  } else if (withoutPrefix.toLowerCase().startsWith('zen/go/')) {
    withoutPrefix = withoutPrefix.slice('zen/go/'.length)
  }

  const normalizedKey = withoutPrefix.toLowerCase().replace(/[\s_]+/g, '-')

  return LEGACY_MODEL_IDS[normalizedKey] ?? withoutPrefix
}

export function resolveAiBaseUrl(baseUrl?: string) {
  const normalized = normalizeBaseUrl(baseUrl ?? '')
  if (!normalized) {
    return DEFAULT_BASE_URL
  }

  if (LEGACY_BASE_URLS.has(normalized.toLowerCase())) {
    return DEFAULT_BASE_URL
  }

  return normalized
}

export function resolveAiModelId(modelId?: string) {
  return normalizeModelId(modelId || DEFAULT_MODEL_ID)
}

export function resolveGeminiBaseUrl(baseUrl?: string): string | undefined {
  const resolved = baseUrl?.trim()
  if (!resolved) {
    return undefined
  }
  return resolved
}

export function resolveGeminiModelId(modelId?: string): string {
  return modelId?.trim() || DEFAULT_GEMINI_MODEL_ID
}

export function resolveGeminiFallbackModelId(modelId?: string): string {
  return modelId?.trim() || DEFAULT_GEMINI_FALLBACK_MODEL_ID
}
