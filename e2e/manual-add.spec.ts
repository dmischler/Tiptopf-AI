import { expect, test } from '@playwright/test'

import { writeSeedStore } from './helpers/seed'

test.beforeEach(() => {
  writeSeedStore()
})

test.describe('manual add', () => {
  test('manual-add saves from the FAB and lands on /library/{id}', async ({ page }) => {
    await page.goto('/library')
    await expect(page.getByRole('heading', { name: 'Deine Bibliothek' })).toBeVisible()

    await page.getByRole('button', { name: 'Menü öffnen' }).click()
    await page.getByRole('button', { name: 'Manuell' }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByLabel('Titel').fill('E2E Manuellsuppe')
    await page.getByLabel(/Zutaten/).fill('1 L Wasser')
    await page.getByLabel(/Anleitung/).fill('Köcheln')
    await page.getByRole('button', { name: 'Speichern' }).click()

    await expect(page).toHaveURL(/\/library\/[0-9a-f-]{36}$/i)
    await expect(page.getByRole('heading', { name: 'E2E Manuellsuppe' })).toBeVisible()

    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Deine Bibliothek' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'E2E Manuellsuppe' })).toBeVisible()
  })
})
