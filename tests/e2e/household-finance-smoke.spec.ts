import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 60_000 });

async function gotoHouseholdPage(page: Page, targetPath: string) {
  await page.goto(targetPath, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {
    /* background polling can keep the network busy */
  });
}

async function expectNoFullPageError(page: Page) {
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('main')).toBeVisible();
  const errorBoundary = page.locator('h2:has-text("Something went wrong")');
  const hasError = await errorBoundary
    .isVisible({ timeout: 1_000 })
    .catch(() => false);
  expect(hasError).toBe(false);
}

test.describe('Household Finance', () => {
  test('root redirects to dashboard', async ({ page }) => {
    await gotoHouseholdPage(page, '/personal');
    await expect(page).toHaveURL(/\/personal\/dashboard/);
    await expectNoFullPageError(page);
    await expect(page.getByText('Personal Dashboard')).toBeVisible();
  });

  test('dashboard renders overview cards', async ({ page }) => {
    await gotoHouseholdPage(page, '/personal/dashboard');
    await expectNoFullPageError(page);
    await expect(page.getByText('Net worth')).toBeVisible();
    await expect(page.getByText('Monthly cash flow')).toBeVisible();
    await expect(page.getByText('Budget status')).toBeVisible();
    await expect(page.getByText('Upcoming bills')).toBeVisible();
  });

  test('accounts page loads key controls', async ({ page }) => {
    await gotoHouseholdPage(page, '/personal/accounts');
    await expectNoFullPageError(page);
    await expect(page.getByText('Account Records')).toBeVisible();
    await expect(page.getByPlaceholder('Search accounts...')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Add Account' })
    ).toBeVisible();
  });

  test('expenses page loads list controls', async ({ page }) => {
    await gotoHouseholdPage(page, '/personal/expenses');
    await expectNoFullPageError(page);
    await expect(page.getByText('Expense Records')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Add Expense' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Download Template' })
    ).toBeVisible();
  });

  test('expenses recurring tab exposes recurring controls', async ({
    page,
  }) => {
    await gotoHouseholdPage(page, '/personal/expenses');
    await expectNoFullPageError(page);
    await page.getByRole('tab', { name: 'Recurring Payments' }).click();
    await expect(
      page.getByPlaceholder('Search recurring payments...')
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Generate This Month' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Add Recurring Payment' })
    ).toBeVisible();
  });

  test('income page loads key controls', async ({ page }) => {
    await gotoHouseholdPage(page, '/personal/income');
    await expectNoFullPageError(page);
    await expect(page.getByText('Income Records')).toBeVisible();
    await expect(page.getByPlaceholder('Search income...')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Add Income' })
    ).toBeVisible();
  });

  test('budgets page loads key controls', async ({ page }) => {
    await gotoHouseholdPage(page, '/personal/budgets');
    await expectNoFullPageError(page);
    await expect(page.getByText('Budget Records')).toBeVisible();
    await expect(page.getByPlaceholder('Search budgets...')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Add Budget' })
    ).toBeVisible();
  });

  test('reports page shows scaffolded planned reports', async ({ page }) => {
    await gotoHouseholdPage(page, '/personal/reports');
    await expectNoFullPageError(page);
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
    await expect(page.getByText('Planned reports')).toBeVisible();
  });

  test('categories page shows scaffolded planned capabilities', async ({
    page,
  }) => {
    await gotoHouseholdPage(page, '/personal/categories');
    await expectNoFullPageError(page);
    await expect(
      page.getByRole('heading', { name: 'Categories' })
    ).toBeVisible();
    await expect(page.getByText('Planned capabilities')).toBeVisible();
  });

  test('settings page shows scaffolded planned controls', async ({ page }) => {
    await gotoHouseholdPage(page, '/personal/settings');
    await expectNoFullPageError(page);
    await expect(page.getByText('Personal Settings')).toBeVisible();
    await expect(page.getByText('Planned controls')).toBeVisible();
  });
});
