import { describe, expect, it } from 'vitest'

import { DEFAULT_BASE_URL, isOpenCodeZenFreeEndpoint, resolveAiBaseUrl } from '@/lib/ai/client'

describe('isOpenCodeZenFreeEndpoint', () => {
  it('treats the default Zen URL as the free endpoint', () => {
    expect(isOpenCodeZenFreeEndpoint()).toBe(true)
    expect(isOpenCodeZenFreeEndpoint(DEFAULT_BASE_URL)).toBe(true)
    expect(isOpenCodeZenFreeEndpoint('https://opencode.ai/zen/v1/')).toBe(true)
  })

  it('does not treat OpenCode Go as free', () => {
    expect(isOpenCodeZenFreeEndpoint('https://opencode.ai/zen/go/v1')).toBe(false)
  })
})

describe('resolveAiBaseUrl', () => {
  it('falls back to the default Zen URL', () => {
    expect(resolveAiBaseUrl()).toBe(DEFAULT_BASE_URL)
    expect(resolveAiBaseUrl('')).toBe(DEFAULT_BASE_URL)
  })
})
