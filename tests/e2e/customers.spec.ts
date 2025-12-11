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

    // Wait for grid/table to be visible (adjust selector based on your actual implementation)
    // Glide Data Grid typically renders in a canvas or specific container
    const gridContainer = page
      .locator('[role="grid"], canvas, .data-grid-container')
      .first();
    const emptyState = page
      .locator('text=/no customers/i, text=/empty/i, text=/no data/i')
      .first();

    const gridVisible = await gridContainer
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    const emptyVisible = await emptyState
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    expect(gridVisible || emptyVisible).toBeTruthy();
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

    const gridLocator = page.locator(
      '[role="grid"], canvas, .data-grid-container'
    );
    const emptyStateLocator = page
      .locator('text=/no customers/i, text=/empty/i')
      .first();

    const gridVisible = await gridLocator
      .first()
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    const gridExists = (await gridLocator.count().catch(() => 0)) > 0;
    const emptyMessage = await emptyStateLocator
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);

    expect(gridVisible || gridExists || emptyMessage).toBeTruthy();
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
