import { expect, test } from '@playwright/test'

import { RECIPE_A_ID, RECIPE_A_TITLE, writeSeedStore } from './helpers/seed'

test.beforeEach(() => {
  writeSeedStore()
})

test.describe('delete undo identity', () => {
  test('delete-undo-id restores the same recipe id', async ({ page }) => {
    await page.goto(`/library/${RECIPE_A_ID}`)
    await expect(page.getByRole('heading', { name: RECIPE_A_TITLE })).toBeVisible()

    const recipeUrl = page.url()
    const idFromUrl = new URL(recipeUrl).pathname.split('/').pop()
    expect(idFromUrl).toBe(RECIPE_A_ID)

    await page.getByRole('button', { name: 'Rezept löschen' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()

    await expect(page).toHaveURL(/\/library$/)
    await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeVisible()
    await page.getByRole('button', { name: 'Rückgängig' }).click()

    await expect(page).toHaveURL(new RegExp(`/library/${RECIPE_A_ID}`))
    await expect(page.getByRole('heading', { name: RECIPE_A_TITLE })).toBeVisible()
  })
})
