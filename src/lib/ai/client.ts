const LEGACY_BASE_URLS = new Set(['https://api.opencode.ai', 'https://api.opencode.ai/v1'])
const DEFAULT_BASE_URL = 'https://opencode.ai/zen/v1'
const DEFAULT_MODEL_ID = 'minimax-m2.5'

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

  const withoutProviderPrefix = trimmed.toLowerCase().startsWith('opencode/')
    ? trimmed.slice('opencode/'.length)
    : trimmed
  const normalizedKey = withoutProviderPrefix.toLowerCase().replace(/[\s_]+/g, '-')

  return LEGACY_MODEL_IDS[normalizedKey] ?? withoutProviderPrefix
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

export function resolveAiModelId() {
  return normalizeModelId(process.env.OPENCODE_MODEL_ID || DEFAULT_MODEL_ID)
}

export { DEFAULT_BASE_URL }
