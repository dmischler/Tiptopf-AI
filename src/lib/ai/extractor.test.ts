import { describe, expect, it } from 'vitest'

import { isOpenCodeFreeTierRestriction } from '@/lib/ai/extractor'

describe('isOpenCodeFreeTierRestriction', () => {
  it('detects the provider restriction message', () => {
    expect(
      isOpenCodeFreeTierRestriction(new Error("OpenCode's free tier can only be used in OpenCode"))
    ).toBe(true)
    expect(isOpenCodeFreeTierRestriction(new Error('rate limit'))).toBe(false)
  })
})
