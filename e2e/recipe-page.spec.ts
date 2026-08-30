import { expect, test } from '@playwright/test'

import { RECIPE_A_ID, RECIPE_A_TITLE, writeSeedStore } from './helpers/seed'

test.beforeEach(() => {
  writeSeedStore()
})

test.describe('recipe page', () => {
  test('recipe-page opens as /library/{uuid} not a dialog overlay', async ({ page }) => {
    await page.goto('/library')
    await expect(page.getByRole('heading', { name: 'Deine Bibliothek' })).toBeVisible()

    await page.locator('a[href^="/library/"]').first().click()
    await expect(page).toHaveURL(new RegExp(`/library/${RECIPE_A_ID}`))
    await expect(page.getByRole('heading', { name: RECIPE_A_TITLE })).toBeVisible()
    await expect(page.locator('[data-print-root]')).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.goBack()
    await expect(page).toHaveURL(/\/library$/)
    await expect(page.getByRole('heading', { name: 'Deine Bibliothek' })).toBeVisible()
  })
})
