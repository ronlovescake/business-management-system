import { test, expect } from '@playwright/test';

test.describe('Business Management App', () => {
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/');

    // Check if the main title is visible
    await expect(page.locator('h1')).toContainText('Czarlie & Ron');
  });

  test('navigation structure is present', async ({ page }) => {
    await page.goto('/');

    // Check if business selector is present
    await expect(page.locator('text=Select Business')).toBeVisible();
  });
});
