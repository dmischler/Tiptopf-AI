function redactSecrets(value: string) {
  return value
    .replace(/(authorization|api[_-]?key|bearer)[=:\s]+\S+/gi, '$1=[redacted]')
    .replace(/\bsk-[a-zA-Z0-9_-]+\b/g, '[redacted]')
    .replace(/\bAIza[a-zA-Z0-9_-]+\b/g, '[redacted]')
}

export function formatSafeError(err: unknown): string {
  if (!err || typeof err !== 'object') {
    return 'unknown error'
  }

  const name = 'name' in err && typeof err.name === 'string' ? err.name : 'Error'
  const status =
    'status' in err && (typeof err.status === 'number' || typeof err.status === 'string')
      ? String(err.status)
      : undefined
  const message = err instanceof Error ? redactSecrets(err.message).slice(0, 200) : ''

  return [name, status ? `status=${status}` : '', message].filter(Boolean).join(' ')
}
