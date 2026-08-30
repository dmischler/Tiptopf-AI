import { expect, test } from '@playwright/test'

import { writeSeedStore } from './helpers/seed'

test.beforeEach(() => {
  writeSeedStore()
})

test.describe('security floor', () => {
  test('image-traversal returns 400', async ({ request }) => {
    const encoded = await request.get('/api/images/..%2F..%2Fetc')
    expect(encoded.status()).toBe(400)

    const dotted = await request.get('/api/images/%2e%2e%2fx.webp')
    expect(dotted.status()).toBe(400)
  })

  test('zoom-disabled keeps maximum-scale=1', async ({ page }) => {
    await page.goto('/library')
    const content = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(content ?? '').toMatch(/maximum-scale\s*=\s*1/i)
  })
})
