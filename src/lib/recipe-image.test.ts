import { describe, expect, it } from 'vitest'

import { isSafeImageName, parseApiImageFileName } from '@/lib/recipe-image'

const UUID_WEBP = '550e8400-e29b-41d4-a716-446655440000.webp'

describe('isSafeImageName', () => {
  it('rejects path traversal', () => {
    expect(isSafeImageName('../x')).toBe(false)
  })

  it('accepts a canonical uuid.webp name', () => {
    expect(isSafeImageName(UUID_WEBP)).toBe(true)
  })

  it('rejects encoded dots before they can traverse', () => {
    expect(isSafeImageName('%2e%2e')).toBe(false)
  })
})

describe('parseApiImageFileName', () => {
  it('rejects %2e%2e after decode', () => {
    expect(parseApiImageFileName('/api/images/%2e%2e%2fx.webp')).toBeNull()
    expect(parseApiImageFileName('/api/images/%2e%2e')).toBeNull()
  })

  it('accepts a uuid.webp API path', () => {
    expect(parseApiImageFileName(`/api/images/${UUID_WEBP}`)).toBe(UUID_WEBP)
  })
})
