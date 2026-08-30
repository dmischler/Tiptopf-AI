import { promises as dns } from 'node:dns'
import { BlockList, isIP, isIPv4 } from 'node:net'

export const UNSAFE_URL_MESSAGE = 'URL nicht erlaubt'

export class UnsafeUrlError extends Error {
  constructor(message = UNSAFE_URL_MESSAGE) {
    super(message)
    this.name = 'UnsafeUrlError'
  }
}

export type SafeFetchPurpose = 'page' | 'image'

export type SafeFetchOptions = {
  timeoutMs: number
  maxBytes: number
  purpose: SafeFetchPurpose
  headers?: Record<string, string>
}

export type SafeFetchResult = {
  bytes: Uint8Array
  contentType: string | null
  finalUrl: string
}

const MAX_REDIRECTS = 3
const DENY = new BlockList()

DENY.addSubnet('0.0.0.0', 8, 'ipv4')
DENY.addSubnet('10.0.0.0', 8, 'ipv4')
DENY.addSubnet('100.64.0.0', 10, 'ipv4')
DENY.addSubnet('127.0.0.0', 8, 'ipv4')
DENY.addSubnet('169.254.0.0', 16, 'ipv4')
DENY.addSubnet('172.16.0.0', 12, 'ipv4')
DENY.addSubnet('192.168.0.0', 16, 'ipv4')
DENY.addSubnet('224.0.0.0', 4, 'ipv4')
DENY.addAddress('255.255.255.255', 'ipv4')
DENY.addAddress('::', 'ipv6')
DENY.addAddress('::1', 'ipv6')
DENY.addSubnet('fe80::', 10, 'ipv6')
DENY.addSubnet('fc00::', 7, 'ipv6')
DENY.addSubnet('ff00::', 8, 'ipv6')

function allowHttpFetch() {
  return process.env.ALLOW_HTTP_FETCH === '1'
}

function mappedIPv4(address: string): string | null {
  const match = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)
  if (match) {
    return match[1]
  }
  return null
}

export function isDeniedIp(address: string): boolean {
  const mapped = mappedIPv4(address)
  if (mapped) {
    return isDeniedIp(mapped)
  }

  try {
    if (isIPv4(address)) {
      return DENY.check(address, 'ipv4')
    }
    return DENY.check(address, 'ipv6')
  } catch {
    return true
  }
}

function assertHostnameAllowed(hostname: string) {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host === '[::1]') {
    throw new UnsafeUrlError()
  }
}

export function parsePublicHttpUrl(raw: string): URL {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new UnsafeUrlError()
  }

  if (parsed.protocol === 'http:') {
    if (!allowHttpFetch()) {
      throw new UnsafeUrlError()
    }
  } else if (parsed.protocol !== 'https:') {
    throw new UnsafeUrlError()
  }

  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError()
  }

  assertHostnameAllowed(parsed.hostname)

  if (isIP(parsed.hostname) && isDeniedIp(parsed.hostname)) {
    throw new UnsafeUrlError()
  }

  return parsed
}

async function resolveHostAddresses(hostname: string): Promise<string[]> {
  if (isIP(hostname)) {
    return [hostname]
  }

  try {
    const results = await dns.lookup(hostname, { all: true })
    if (results.length === 0) {
      throw new Error('ENOTFOUND')
    }
    return results.map((entry) => entry.address)
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      throw error
    }
    throw new Error('URL konnte nicht geladen werden.')
  }
}

export async function assertSafeHttpUrl(raw: string): Promise<URL> {
  const parsed = parsePublicHttpUrl(raw)
  const addresses = await resolveHostAddresses(parsed.hostname)
  if (addresses.some((address) => isDeniedIp(address))) {
    throw new UnsafeUrlError()
  }
  return parsed
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const contentLength = response.headers.get('content-length')
  if (contentLength) {
    const declared = Number(contentLength)
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new Error('Antwort zu groß.')
    }
  }

  if (!response.body) {
    return new Uint8Array()
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new Error('Antwort zu groß.')
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export async function safeFetch(url: string, opts: SafeFetchOptions): Promise<SafeFetchResult> {
  const headers = {
    Accept: opts.purpose === 'image' ? 'image/*,*/*;q=0.8' : 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    ...opts.headers,
  }

  let current = url

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertSafeHttpUrl(current)

    let response: Response
    try {
      response = await fetch(current, {
        method: 'GET',
        headers,
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(opts.timeoutMs),
      })
    } catch (error) {
      if (error instanceof UnsafeUrlError) {
        throw error
      }
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        throw new Error('Zeitüberschreitung beim Laden der URL.')
      }
      throw new Error('URL konnte nicht geladen werden.')
    }

    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel().catch(() => undefined)
      const location = response.headers.get('location')
      if (!location || hop === MAX_REDIRECTS) {
        throw new UnsafeUrlError()
      }
      try {
        current = new URL(location, current).toString()
      } catch {
        throw new UnsafeUrlError()
      }
      continue
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined)
      throw new Error('URL konnte nicht geladen werden.')
    }

    const bytes = await readLimitedBody(response, opts.maxBytes)
    return {
      bytes,
      contentType: response.headers.get('content-type'),
      finalUrl: current,
    }
  }

  throw new UnsafeUrlError()
}
