import { expect, test } from '@playwright/test'

test.describe('Tiptopf App', () => {
  test('root route redirects to library', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/.*\/library/)
  })

  test('legacy auth routes redirect to library', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/.*\/library/)

    await page.goto('/signup')
    await expect(page).toHaveURL(/.*\/library/)
  })

  test('library page is reachable', async ({ page }) => {
    await page.goto('/library')
    await expect(page.getByRole('heading', { name: 'Your library' })).toBeVisible()
  })
})
