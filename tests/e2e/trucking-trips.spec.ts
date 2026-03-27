import { test, expect, type Page } from '@playwright/test';

test.describe.configure({ timeout: 60_000 });

async function gotoTruckingTripsPage(page: Page) {
  try {
    await page.goto('/trucking/operations/trips', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
  } catch {
    await page.goto('/trucking/operations/trips', {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
  }

  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {
    /* some requests may continue polling */
  });
}

function statLabel(page: Page, label: string) {
  return page
    .locator('p')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .first();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'business-store',
      JSON.stringify({
        state: {
          selectedBusiness: 'trucking',
          selectedWorkspace: 'operations',
        },
        version: 0,
      })
    );
  });
});

test.describe('Trucking trips dashboard', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Chromium-only regression coverage'
  );

  test('loads the trips dashboard contract', async ({ page }) => {
    await gotoTruckingTripsPage(page);

    await expect(page.locator('body')).toBeVisible();
    await expect(statLabel(page, 'Total Revenue')).toBeVisible();
    await expect(statLabel(page, 'Total Expenses')).toBeVisible();
    await expect(statLabel(page, 'Net Margin')).toBeVisible();
    await expect(statLabel(page, 'Trips This Month')).toBeVisible();
    await expect(
      page.getByPlaceholder(
        /search driver, helper, truck, destination, or remarks/i
      )
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /log trip/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible();
  });

  test('shows analytics metrics when switching panels', async ({ page }) => {
    await gotoTruckingTripsPage(page);

    await page.getByRole('tab', { name: /analytics/i }).click();

    const analyticsPanel = page
      .locator('[role="tabpanel"]')
      .filter({ hasText: 'Total Trips Logged' });

    await expect(
      analyticsPanel.getByText('Total Trips Logged', { exact: true })
    ).toBeVisible();
    await expect(
      analyticsPanel.getByText('Trips This Month', { exact: true })
    ).toBeVisible();
    await expect(
      analyticsPanel.getByText('Gross Revenue (All Time)', { exact: true })
    ).toBeVisible();
    await expect(
      analyticsPanel.getByText(/filtered view revenue vs expenses/i)
    ).toBeVisible();
  });

  test('opens the log trip modal and reveals override fields', async ({
    page,
  }) => {
    await gotoTruckingTripsPage(page);

    await page.getByRole('button', { name: /log trip/i }).click();

    const dialog = page.getByRole('dialog');

    await expect(dialog.getByText('Log a trip')).toBeVisible();
    await expect(dialog.getByLabel('Trip date')).toBeVisible();
    await expect(
      dialog.getByRole('textbox', { name: 'Vehicle' })
    ).toBeVisible();
    await expect(dialog.getByLabel('Destination')).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Driver' })).toBeVisible();
    await expect(
      dialog.getByRole('textbox', { name: 'Gross revenue' })
    ).toBeVisible();

    await dialog.getByText('Override crew / reliever', { exact: true }).click();

    await expect(
      dialog.getByRole('textbox', { name: 'Actual driver / reliever' })
    ).toBeVisible();
    await expect(
      dialog.getByRole('textbox', { name: 'Actual helper / reliever' })
    ).toBeVisible();
    await expect(dialog.getByLabel('Crew override reason')).toBeVisible();
    await expect(
      dialog.getByRole('textbox', { name: 'Attendance status' })
    ).toBeVisible();

    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });
});
