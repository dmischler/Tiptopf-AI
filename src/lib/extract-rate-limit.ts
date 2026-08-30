const WINDOW_MS = 10 * 60 * 1000
const MAX_EXTRACTS = 10

const timestamps: number[] = []

export function assertExtractRateLimit() {
  const now = Date.now()
  while (timestamps.length > 0 && timestamps[0] < now - WINDOW_MS) {
    timestamps.shift()
  }

  if (timestamps.length >= MAX_EXTRACTS) {
    throw new Error('Zu viele Extraktionen. Bitte warte ein paar Minuten.')
  }

  timestamps.push(now)
}
