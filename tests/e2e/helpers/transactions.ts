import type { Page } from '@playwright/test';

type WaitOptions = {
  timeout?: number;
};

export async function waitForTransactionsContent(
  page: Page,
  options: WaitOptions = {}
): Promise<void> {
  const timeout = options.timeout ?? 45000;
  const deadline = Date.now() + timeout;

  await page.locator('body').waitFor({ state: 'visible', timeout: 10000 });

  const skeleton = page
    .locator('.mantine-Skeleton-root, [data-testid="table-skeleton"]')
    .first();
  const skeletonTimeout = Math.min(20000, timeout);
  await skeleton
    .waitFor({ state: 'detached', timeout: skeletonTimeout })
    .catch(() => {
      /* skeleton may not render; continue */
    });

  const candidateLocators = [
    page.locator('input[placeholder*="Search transactions" i]').first(),
    page.locator('text=/Showing \\d+ of \\d+ transactions/i').first(),
    page.locator('[role="grid"], canvas, .data-grid-container').first(),
    page
      .locator(
        'button:has-text("Create Packing List"), button:has-text("Create Distribution"), button:has-text("Create Invoice")'
      )
      .first(),
  ];

  while (Date.now() < deadline) {
    for (const locator of candidateLocators) {
      const isVisible = await locator
        .isVisible()
        .then(Boolean)
        .catch(() => false);

      if (isVisible) {
        return;
      }
    }

    await page.waitForTimeout(500);
  }

  throw new Error('Transactions content did not render within timeout.');
}
