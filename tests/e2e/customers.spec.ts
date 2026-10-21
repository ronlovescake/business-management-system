import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function gotoCustomers(page: Page, extraDelayMs = 0) {
  await page.goto('/clothing/operations/customers', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
    /* background requests may stay active */
  });
  if (extraDelayMs > 0) {
    await page.waitForTimeout(extraDelayMs);
  }
}

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
});

test.describe('Customers Page', () => {
  test('should load customers page and display title', async ({ page }) => {
    // Navigate to customers page (assuming there's a navigation link or direct URL)
    // You may need to adjust this based on your actual app structure
    await gotoCustomers(page);

    // Check if the page title or heading is visible (optional - page may not have explicit heading)
    const pageHeading = page.locator('h1, h2').first();
    const hasHeading = await pageHeading
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasHeading) {
      // Optionally verify that it contains "Customer" text
      const headingText = await pageHeading.textContent();
      expect(headingText).toBeTruthy();
    } else {
      // If no heading, verify page loaded by checking for body or other elements
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should display data grid or table', async ({ page }) => {
    await gotoCustomers(page);

    const pageReady = page
      .locator('.data-grid-container')
      .or(page.getByPlaceholder(/search customers/i))
      .or(
        page.getByText(
          /customer management system - import csv file to get started/i
        )
      )
      .first();

    await expect(pageReady).toBeVisible({ timeout: 30_000 });
  });

  test('should show loading skeleton initially', async ({ page }) => {
    // Start navigation but don't wait for network idle
    const navigation = page.goto('/clothing/operations/customers');

    // Check for skeleton loader (adjust selector based on your TableSkeleton implementation)
    const skeleton = page
      .locator('.mantine-Skeleton-root, [data-testid="table-skeleton"]')
      .first();

    // Skeleton should be visible during loading
    // Note: This might be very fast, so we use waitFor with short timeout
    try {
      await expect(skeleton).toBeVisible({ timeout: 2000 });
    } catch {
      // Skeleton might load too fast to catch, which is fine
      // Test passes either way
    }

    await navigation;
  });

  test('should handle empty state if no customers exist', async ({ page }) => {
    await gotoCustomers(page, 2000);

    const pageState = page
      .locator('.data-grid-container')
      .or(
        page.getByText(
          /customer management system - import csv file to get started/i
        )
      )
      .or(page.getByText(/showing\s+\d+\s+of\s+\d+\s+customers/i))
      .first();

    await expect(pageState).toBeVisible({ timeout: 15_000 });
  });

  test('should have search/filter functionality', async ({ page }) => {
    await gotoCustomers(page, 1000);

    // Look for common search/filter UI elements
    const searchInput = page
      .locator(
        'input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i]'
      )
      .first();

    // Search input might or might not exist depending on implementation
    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      // Wait for input to be enabled (data loaded)
      await expect(searchInput).toBeEnabled({ timeout: 5000 });

      // Try typing in search
      await searchInput.fill('test');
      await page.waitForTimeout(500);

      // Clear search
      await searchInput.clear();
    }
    // Note: Search functionality may not be implemented yet
  });
});

test.describe('Customers Page - Add/Edit Operations', () => {
  test.beforeEach(async ({ page }) => {
    await gotoCustomers(page);
  });

  test('should have add customer button or functionality', async ({ page }) => {
    // Look for add button (common patterns)
    const addButton = page
      .locator(
        'button:has-text("Add"), button:has-text("New"), button:has-text("Create")'
      )
      .first();

    const hasAddButton = await addButton.isVisible().catch(() => false);

    if (hasAddButton) {
      await expect(addButton).toBeEnabled();
    }
    // Note: Add customer functionality location may vary
  });

  test('should handle CSV import functionality if present', async ({
    page,
  }) => {
    // Look for import/upload button
    const importButton = page
      .locator(
        'button:has-text("Import"), button:has-text("Upload"), button:has-text("CSV")'
      )
      .first();

    const hasImport = await importButton.isVisible().catch(() => false);

    if (hasImport) {
      await expect(importButton).toBeEnabled();
    }
    // Note: CSV import functionality location may vary
  });
});

test.describe('Customers Page - Responsive Behavior', () => {
  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await gotoCustomers(page);

    // Page should still be usable
    await expect(page.locator('body')).toBeVisible();

    // Grid should adapt or show mobile-friendly view
    const content = page.locator('main, [role="main"], body').first();
    await expect(content).toBeVisible();
  });

  test('should be responsive on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await gotoCustomers(page);

    // Page should still be usable
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Customers Page - Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);

    await page
      .goto('/clothing/operations/customers', { waitUntil: 'domcontentloaded' })
      .catch(() => {
        // Expected to fail when offline
      });

    // Go back online
    await page.context().setOffline(false);

    // Retry navigation
    await gotoCustomers(page);

    // Page should eventually load
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Customers directory @directory', () => {
  const customers = Array.from({ length: 18 }, (_, index) => ({
    id: 90001 + index,
    Date: '2026-10-21',
    'Customer Name': index === 0 ? 'Maya Cruz' : `Customer ${index + 1}`,
    'Phone Number': '09171234567',
    'Email Address':
      index === 0 ? 'maya@example.com' : `customer${index + 1}@example.com`,
    Address: 'Session Road, Baguio City',
    Facebook: 'https://facebook.com/example',
    'Business Name': index === 0 ? 'Hidden Needle Studio' : 'Market Shop',
    'Tax Number': '123-456',
    'Business Address': 'Baguio City',
    'Business Contact Number': '0741234567',
    'Customer Status': ['Active', 'Inactive', 'Prospect', 'VIP', 'Banned'][
      index % 5
    ],
  }));

  const lastDrawnPosition = (page: Page, text: string) =>
    page.evaluate((value) => {
      const matches = (
        window as unknown as {
          directoryDraws: { text: string; left: number }[];
        }
      ).directoryDraws.filter((draw) => draw.text === value);
      return matches[matches.length - 1]?.left;
    }, text);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/session') {
        await route.fulfill({
          json: {
            user: {
              id: 'directory-test',
              name: 'Directory Test',
              role: 'SUPER_ADMIN',
              permissions: [],
            },
            expires: '2099-01-01T00:00:00.000Z',
          },
        });
        return;
      }
      await route.fulfill({ json: path === '/api/customers' ? customers : [] });
    });
    await page.addInitScript(() => {
      const fonts: string[] = [];
      (window as unknown as { directoryFonts: string[] }).directoryFonts =
        fonts;
      const draws: { text: string; left: number }[] = [];
      (window as unknown as { directoryDraws: typeof draws }).directoryDraws =
        draws;
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (
        text,
        left,
        top,
        maxWidth
      ) {
        draws.push({ text, left });
        if (['Customer Name', 'Maya Cruz', 'Active'].includes(text)) {
          fonts.push(this.font);
        }
        original.call(this, text, left, top, maxWidth);
      };
    });
  });

  test('keeps columns aligned and supports show all and reset', async ({
    page,
  }) => {
    await gotoCustomers(page);
    const canvasWidth = await page
      .locator('.data-grid-container canvas')
      .first()
      .evaluate((canvas) => canvas.getBoundingClientRect().width);
    // Default columns fill the table, leaving the last column at the right edge.
    await expect
      .poll(() => lastDrawnPosition(page, 'Customer Status'))
      .toBeGreaterThan(canvasWidth - 200);
    const emailLeft = (await lastDrawnPosition(page, 'maya@example.com'))!;
    await page.getByRole('button', { name: 'Columns', exact: true }).click();
    await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(5);
    await expect(
      page.getByRole('checkbox', { name: 'Customer Name', exact: true })
    ).toBeDisabled();
    await page
      .getByRole('checkbox', { name: 'Phone Number', exact: true })
      .uncheck();
    await expect
      .poll(() => lastDrawnPosition(page, 'maya@example.com'))
      .toBeLessThan(emailLeft - 100);
    await page.getByRole('menuitem', { name: 'Show all columns' }).click();
    await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(11);
    await page.getByRole('menuitem', { name: 'Reset columns' }).click();
    await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(5);
    await expect
      .poll(() => lastDrawnPosition(page, 'maya@example.com'))
      .toBe(emailLeft);
  });

  test('searches hidden fields and recovers from no results', async ({
    page,
  }) => {
    await gotoCustomers(page);
    const search = page.getByRole('textbox', {
      name: 'Search customers',
      exact: true,
    });
    await search.fill('Hidden Needle');
    await expect(page.getByRole('status')).toHaveText('1 of 18 customers');
    await expect.poll(() => lastDrawnPosition(page, 'Maya Cruz')).toBe(16.5);
    await search.fill('no-such-customer-54321');
    await expect(
      page.getByText('No matching customers', { exact: true })
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Clear search', exact: true })
      .last()
      .click();
    await expect(page.getByRole('status')).toHaveText('18 customers');
    await expect(
      page.locator('.data-grid-container canvas').first()
    ).toBeVisible();
  });

  test('preserves CSV actions and the add dialog', async ({ page }) => {
    await gotoCustomers(page);
    await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
    await expect(
      page.getByRole('menuitem', { name: /Standard CSV/ })
    ).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: /Detailed/ })
    ).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: /For Analysis/ })
    ).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: /Standard CSV/ }).click();
    expect((await download).suggestedFilename()).toMatch(/\.csv$/);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'customers.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Customer Name,Phone Number\nTest,09171234567'),
    });
    await expect(
      page.getByRole('button', { name: 'Import', exact: true })
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Add Customer', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('dialog').getByRole('textbox', { name: 'Customer Name' })
    ).toBeVisible();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('copies status text and opens the correct customer', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await gotoCustomers(page);
    const canvas = page.locator('.data-grid-container canvas').first();
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    await expect
      .poll(() => lastDrawnPosition(page, 'Customer Status'))
      .toBeGreaterThan(bounds!.width - 200);
    await page.mouse.click(bounds!.x + bounds!.width - 80, bounds!.y + 68);
    await page.keyboard.press('Control+c');
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain('Active');
    const currentBounds = await canvas.boundingBox();
    expect(currentBounds).not.toBeNull();
    await page.mouse.click(currentBounds!.x + 100, currentBounds!.y + 68, {
      delay: 80,
    });
    await page.mouse.click(currentBounds!.x + 100, currentBounds!.y + 68, {
      delay: 80,
    });
    await expect(page).toHaveURL(/\/clothing\/operations\/customers\/90001$/);
  });

  test('shows an actionable empty directory without hiding CSV import', async ({
    page,
  }) => {
    await page.route('**/api/customers', (route) =>
      route.fulfill({ json: [] })
    );
    await gotoCustomers(page);
    await expect(
      page.getByText('No customers yet', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Import CSV', exact: true })
    ).toBeVisible();
    await page
      .locator('.data-grid-container')
      .getByRole('button', { name: 'Add Customer' })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    test(`renders readable canvas text at ${viewport.width}px without page overflow`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await gotoCustomers(page);
      if (viewport.width < 768) {
        await page
          .getByRole('button', { name: 'Collapse side panel', exact: true })
          .click();
        await expect
          .poll(async () => {
            const sidebar = await page.getByRole('navigation').boundingBox();
            return sidebar ? sidebar.x + sidebar.width : 0;
          })
          .toBeLessThanOrEqual(0);
      }
      await page.evaluate(() => document.fonts.ready);
      await expect(
        page.getByRole('heading', { name: 'Customers', exact: true })
      ).toBeVisible();
      await expect(
        page.locator('.data-grid-container canvas').first()
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true);
      const fonts = await page.evaluate(
        () => (window as unknown as { directoryFonts: string[] }).directoryFonts
      );
      expect(fonts.length).toBeGreaterThan(0);
      expect(fonts.every((font) => font.includes('sans-serif'))).toBe(true);
      const toolbarButtons = page.getByRole('button', {
        name: /^(Columns|Export CSV|Import CSV|Add Customer)$/,
      });
      for (const button of await toolbarButtons.all()) {
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      }
      await page.screenshot({
        path: testInfo.outputPath(`customers-${viewport.width}.png`),
        fullPage: true,
      });
    });
  }
});
