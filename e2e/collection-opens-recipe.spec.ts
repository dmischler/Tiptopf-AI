import { expect, test } from '@playwright/test'

import { COLLECTION_NAME, RECIPE_A_ID, RECIPE_A_TITLE, writeSeedStore } from './helpers/seed'

test.beforeEach(() => {
  writeSeedStore()
})

test.describe('collections', () => {
  test('collection-opens-recipe navigates to /library/{id}', async ({ page }) => {
    await page.goto('/collections')
    await expect(page.getByRole('heading', { name: 'Sammlungen' })).toBeVisible()

    await page.getByRole('heading', { name: COLLECTION_NAME }).click()
    await expect(page).toHaveURL(/\/collections\/[0-9a-f-]{36}$/i)

    await page.getByRole('link', { name: RECIPE_A_TITLE }).click()
    await expect(page).toHaveURL(new RegExp(`/library/${RECIPE_A_ID}`))
    await expect(page.getByRole('heading', { name: RECIPE_A_TITLE })).toBeVisible()
    await expect(page.getByText('In Bibliothek öffnen')).toHaveCount(0)
  })
})
