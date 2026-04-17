import { test, expect } from '@playwright/test';

test.describe('Tiptopf App', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('signup page loads', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByText('Create your account')).toBeVisible();
  });

  test('library page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/library');
    await expect(page).toHaveURL(/.*\/login/);
  });
});