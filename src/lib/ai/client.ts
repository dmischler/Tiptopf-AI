const DEFAULT_BASE_URL = 'https://api.opencode.ai/v1'
const DEFAULT_MODEL_ID = 'MiniMax-M2.7'

export function resolveAiBaseUrl(baseUrl?: string) {
  return baseUrl || DEFAULT_BASE_URL
}

export function resolveAiModelId() {
  return process.env.OPENCODE_MODEL_ID || DEFAULT_MODEL_ID
}

export { DEFAULT_BASE_URL }
