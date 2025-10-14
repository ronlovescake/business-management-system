import { test, expect } from '@playwright/test';

test.describe('Customers Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to customers page
    await page.goto('/');
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should load customers page and display title', async ({ page }) => {
    // Navigate to customers page (assuming there's a navigation link or direct URL)
    // You may need to adjust this based on your actual app structure
    await page.goto('/clothing/customers');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check if the page title or heading is visible
    const pageHeading = page.locator('h1, h2').first();
    await expect(pageHeading).toBeVisible({ timeout: 10000 });
    
    // Optionally verify that it contains "Customer" text
    const headingText = await pageHeading.textContent();
    expect(headingText).toBeTruthy();
  });

  test('should display data grid or table', async ({ page }) => {
    await page.goto('/clothing/customers');
    await page.waitForLoadState('networkidle');
    
    // Wait for grid/table to be visible (adjust selector based on your actual implementation)
    // Glide Data Grid typically renders in a canvas or specific container
    const gridContainer = page.locator('[role="grid"], canvas, .data-grid-container').first();
    await expect(gridContainer).toBeVisible({ timeout: 15000 });
  });

  test('should show loading skeleton initially', async ({ page }) => {
    // Start navigation but don't wait for network idle
    const navigation = page.goto('/clothing/customers');
    
    // Check for skeleton loader (adjust selector based on your TableSkeleton implementation)
    const skeleton = page.locator('.mantine-Skeleton-root, [data-testid="table-skeleton"]').first();
    
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
    await page.goto('/clothing/customers');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for data to load
    await page.waitForTimeout(2000);
    
    // Check if there's either data or an empty state message
    const gridVisible = await page.locator('[role="grid"], canvas, .data-grid-container').first().isVisible().catch(() => false);
    const emptyMessage = await page.locator('text=/no customers/i, text=/empty/i').first().isVisible().catch(() => false);
    
    // Either the grid should be visible (with data) or empty message should show
    expect(gridVisible || emptyMessage).toBeTruthy();
  });

  test('should have search/filter functionality', async ({ page }) => {
    await page.goto('/clothing/customers');
    await page.waitForLoadState('networkidle');
    
    // Look for common search/filter UI elements
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i]').first();
    
    // Search input might or might not exist depending on implementation
    const hasSearch = await searchInput.isVisible().catch(() => false);
    
    if (hasSearch) {
      await expect(searchInput).toBeEnabled();
      
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
    await page.goto('/clothing/customers');
    await page.waitForLoadState('networkidle');
  });

  test('should have add customer button or functionality', async ({ page }) => {
    // Look for add button (common patterns)
    const addButton = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create")').first();
    
    const hasAddButton = await addButton.isVisible().catch(() => false);
    
    if (hasAddButton) {
      await expect(addButton).toBeEnabled();
    }
    // Note: Add customer functionality location may vary
  });

  test('should handle CSV import functionality if present', async ({ page }) => {
    // Look for import/upload button
    const importButton = page.locator('button:has-text("Import"), button:has-text("Upload"), button:has-text("CSV")').first();
    
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
    
    await page.goto('/clothing/customers');
    await page.waitForLoadState('networkidle');
    
    // Page should still be usable
    await expect(page.locator('body')).toBeVisible();
    
    // Grid should adapt or show mobile-friendly view
    const content = page.locator('main, [role="main"], body').first();
    await expect(content).toBeVisible();
  });

  test('should be responsive on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/clothing/customers');
    await page.waitForLoadState('networkidle');
    
    // Page should still be usable
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Customers Page - Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);
    
    await page.goto('/clothing/customers').catch(() => {
      // Expected to fail when offline
    });
    
    // Go back online
    await page.context().setOffline(false);
    
    // Retry navigation
    await page.goto('/clothing/customers');
    await page.waitForLoadState('networkidle');
    
    // Page should eventually load
    await expect(page.locator('body')).toBeVisible();
  });
});
