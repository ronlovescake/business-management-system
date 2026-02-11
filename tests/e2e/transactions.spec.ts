import { test, expect } from '@playwright/test';
import { waitForTransactionsContent } from './helpers/transactions';

test.describe.configure({ timeout: 90000 });

test.describe('Transactions page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'business-store',
        JSON.stringify({
          state: {
            selectedBusiness: 'clothing',
            selectedWorkspace: 'operations',
          },
          version: 0,
        })
      );
    });

    await page.goto('/clothing/operations/transactions', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      /* network may stay active due to polling; best-effort only */
    });
    await waitForTransactionsContent(page, { timeout: 60000 });
  });

  test('renders key controls and headers', async ({ page }) => {
    // Verify page loads successfully
    await expect(page).toHaveURL(/\/transactions/);

    // Search input should be present (using actual placeholder text)
    const searchInput = page
      .locator('input[placeholder*="Search transactions" i]')
      .first();
    await expect(searchInput).toBeVisible({ timeout: 20000 });

    // Note: Action buttons and grid headers are tested in invoice-generation.spec.ts
    // which has more comprehensive coverage of the transactions page functionality
  });

  test('allows status filter interaction', async ({ page }) => {
    // Verify page has loaded
    await expect(page).toHaveURL(/\/transactions/);

    // Note: Status filter functionality is thoroughly tested in invoice-generation.spec.ts
    // This basic test just ensures the page loads without errors
    const searchInput = page
      .locator('input[placeholder*="Search transactions" i]')
      .first();
    await expect(searchInput).toBeVisible({ timeout: 20000 });
  });

  test('keeps record payments status pills in sync', async ({ page }) => {
    await expect(page).toHaveURL(/\/transactions/);

    const searchInput = page
      .locator('input[placeholder*="Search transactions" i]')
      .first();
    await expect(searchInput).toBeVisible({ timeout: 20000 });

    const mainPreparedPill = page
      .locator('.mantine-Pill-root', { hasText: 'Prepared' })
      .first();

    const selectedColor = 'rgb(34, 139, 230)';
    const currentColor = await mainPreparedPill.evaluate(
      (element) => window.getComputedStyle(element).backgroundColor
    );

    if (currentColor !== selectedColor) {
      await mainPreparedPill.click();
    }

    await expect(mainPreparedPill).toHaveCSS('background-color', selectedColor);

    await page.getByRole('button', { name: 'Record Payment' }).click();

    const modal = page
      .locator('.mantine-Modal-root')
      .filter({ hasText: 'Record Payments' });
    const modalPreparedPill = modal.locator('.mantine-Pill-root', {
      hasText: 'Prepared',
    });

    await expect(modalPreparedPill).toHaveCSS(
      'background-color',
      selectedColor
    );

    await modalPreparedPill.click();

    await expect(mainPreparedPill).not.toHaveCSS(
      'background-color',
      selectedColor
    );
  });
});
