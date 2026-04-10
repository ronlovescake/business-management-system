import { test, expect, type Page } from '@playwright/test';

test.describe.configure({ timeout: 60_000 });

async function gotoPage(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {
    /* background polling can keep the network busy */
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'business-store',
      JSON.stringify({
        state: {
          selectedBusiness: 'general-merchandise',
          selectedWorkspace: 'operations',
        },
        version: 0,
      })
    );
  });
});

test.describe('General Merchandise — Operations', () => {
  test('operations root redirects to transactions and the page loads', async ({
    page,
  }) => {
    await gotoPage(page, '/general-merchandise/operations');
    await expect(page).toHaveURL(
      /\/general-merchandise\/operations\/transactions/
    );
    await expect(page.locator('body')).toBeVisible();
  });

  test('transactions page is reachable directly', async ({ page }) => {
    await gotoPage(page, '/general-merchandise/operations/transactions');
    await expect(page).toHaveURL(
      /\/general-merchandise\/operations\/transactions/
    );
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('General Merchandise — Accounting', () => {
  test('accounting root redirects to journal and the page loads', async ({
    page,
  }) => {
    await gotoPage(page, '/general-merchandise/accounting');
    await expect(page).toHaveURL(/\/general-merchandise\/accounting\/journal/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('journal page is reachable directly', async ({ page }) => {
    await gotoPage(page, '/general-merchandise/accounting/journal');
    await expect(page).toHaveURL(/\/general-merchandise\/accounting\/journal/);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('General Merchandise — Employees', () => {
  test('employees root redirects to dashboard and the page loads', async ({
    page,
  }) => {
    await gotoPage(page, '/general-merchandise/employees');
    await expect(page).toHaveURL(/\/general-merchandise\/employees\/dashboard/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('team page is reachable directly', async ({ page }) => {
    await gotoPage(page, '/general-merchandise/employees/team');
    await expect(page).toHaveURL(/\/general-merchandise\/employees\/team/);
    await expect(page.locator('body')).toBeVisible();
  });
});
