import { expect, test } from '@playwright/test'

import { writeSeedStore } from './helpers/seed'

test.beforeEach(() => {
  writeSeedStore()
})

test.describe('Tiptopf App', () => {
  test('root route redirects to library', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/.*\/library/)
  })

  test('library-loads', async ({ page }) => {
    await page.goto('/library')
    await expect(page.getByRole('heading', { name: 'Deine Bibliothek' })).toBeVisible()
  })
})

