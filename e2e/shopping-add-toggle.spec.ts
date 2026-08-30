import { expect, test } from '@playwright/test'

import { writeSeedStore } from './helpers/seed'

test.beforeEach(() => {
  writeSeedStore()
})

test.describe('shopping list', () => {
  test('shopping-add-toggle persists a checked item across reload', async ({ page }) => {
    await page.goto('/einkaufsliste')
    await expect(page.getByRole('heading', { name: 'Einkaufsliste' })).toBeVisible()

    await page.getByPlaceholder(/Zutat manuell hinzufügen/).fill('Milch')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await expect(page.getByText('Milch')).toBeVisible()

    const toggleDone = page.waitForResponse((response) => Boolean(response.request().headers()['next-action']))
    await page.getByRole('button', { name: 'Als erledigt markieren' }).click()
    await toggleDone
    await expect(page.getByText('1 / 1 erledigt')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Als unerledigt markieren' })).toBeVisible()

    await page.reload()
    await expect(page.getByText('Milch')).toBeVisible()
    await expect(page.getByText('1 / 1 erledigt')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Als unerledigt markieren' })).toBeVisible()
  })
})
