import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  assertSafeHttpUrl,
  isDeniedIp,
  parsePublicHttpUrl,
  UnsafeUrlError,
} from '@/lib/http/safe-fetch'

const previousAllowHttp = process.env.ALLOW_HTTP_FETCH

afterEach(() => {
  if (previousAllowHttp === undefined) {
    delete process.env.ALLOW_HTTP_FETCH
  } else {
    process.env.ALLOW_HTTP_FETCH = previousAllowHttp
  }
  vi.restoreAllMocks()
})

describe('isDeniedIp', () => {
  it.each(['127.0.0.1', '192.168.1.1', '169.254.169.254', '10.0.0.1', '::1'])(
    'denies %s',
    (address) => {
      expect(isDeniedIp(address)).toBe(true)
    },
  )
})

describe('parsePublicHttpUrl (hostname checks, no DNS)', () => {
  it('rejects loopback, private, link-local, and file URLs', () => {
    process.env.ALLOW_HTTP_FETCH = '1'

    expect(() => parsePublicHttpUrl('http://127.0.0.1/x')).toThrow(UnsafeUrlError)
    expect(() => parsePublicHttpUrl('http://192.168.1.1/x')).toThrow(UnsafeUrlError)
    expect(() => parsePublicHttpUrl('http://169.254.169.254/')).toThrow(UnsafeUrlError)
    expect(() => parsePublicHttpUrl('file:///etc/passwd')).toThrow(UnsafeUrlError)
  })

  it('rejects http when ALLOW_HTTP_FETCH is not set', () => {
    delete process.env.ALLOW_HTTP_FETCH
    expect(() => parsePublicHttpUrl('http://example.com/recipe')).toThrow(UnsafeUrlError)
  })

  it('accepts a public https hostname without looking up DNS', () => {
    const parsed = parsePublicHttpUrl('https://example.com/recipe')
    expect(parsed.hostname).toBe('example.com')
    expect(parsed.pathname).toBe('/recipe')
  })
})

describe('assertSafeHttpUrl', () => {
  it('rejects blocked IP literals without DNS', async () => {
    process.env.ALLOW_HTTP_FETCH = '1'
    await expect(assertSafeHttpUrl('http://127.0.0.1/x')).rejects.toBeInstanceOf(UnsafeUrlError)
    await expect(assertSafeHttpUrl('https://192.168.1.1/x')).rejects.toBeInstanceOf(UnsafeUrlError)
    await expect(assertSafeHttpUrl('https://169.254.169.254/')).rejects.toBeInstanceOf(UnsafeUrlError)
    await expect(assertSafeHttpUrl('file:///etc/passwd')).rejects.toBeInstanceOf(UnsafeUrlError)
  })

  it('accepts a public hostname when lookup returns a public IP', async () => {
    const dns = await import('node:dns')
    vi.spyOn(dns.promises, 'lookup').mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
    ] as unknown as Awaited<ReturnType<typeof dns.promises.lookup>>)

    const parsed = await assertSafeHttpUrl('https://example.com/recipe')
    expect(parsed.hostname).toBe('example.com')
  })
})
