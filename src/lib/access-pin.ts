import { createHash, timingSafeEqual } from 'node:crypto'

export const ACCESS_PIN_COOKIE = 'tiptopf_pin'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export function getConfiguredAccessPin(): string | null {
  const pin = process.env.ACCESS_PIN?.trim()
  return pin ? pin : null
}

export function isAccessPinEnabled(): boolean {
  return getConfiguredAccessPin() !== null
}

function hashPin(pin: string): Buffer {
  return createHash('sha256').update(pin, 'utf8').digest()
}

export function cookieValueForPin(pin: string): string {
  return hashPin(pin).toString('hex')
}

export function pinMatches(candidate: string, expected: string): boolean {
  const left = hashPin(candidate)
  const right = hashPin(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function cookieMatchesPin(cookieValue: string | undefined, pin: string): boolean {
  const expected = Buffer.from(cookieValueForPin(pin), 'utf8')
  const actual = Buffer.from(cookieValue ?? '', 'utf8')
  if (actual.length !== expected.length) {
    timingSafeEqual(expected, expected)
    return false
  }
  return timingSafeEqual(actual, expected)
}

export function safeInternalPath(value: unknown): string {
  if (typeof value !== 'string') {
    return '/library'
  }

  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/gate')) {
    return '/library'
  }

  return value
}

export function accessPinCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  }
}

export async function assertAccess(): Promise<void> {
  const pin = getConfiguredAccessPin()
  if (!pin) {
    return
  }

  const { cookies } = await import('next/headers')
  const jar = await cookies()
  if (!cookieMatchesPin(jar.get(ACCESS_PIN_COOKIE)?.value, pin)) {
    throw new Error('Zugriff verweigert.')
  }
}
