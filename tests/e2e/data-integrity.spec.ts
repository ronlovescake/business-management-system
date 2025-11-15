import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        'postgresql://test:test@localhost:5433/business_management_test',
    },
  },
});

const DATA_DRIFT_TOLERANCE = 5; // allow minor differences when other tests mutate the shared DB

test.describe('Data integrity sweep', () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('transactions inventory remains stable across reloads', async ({
    page,
  }) => {
    const baseline = await prisma.transaction.count();

    await page.goto('/clothing/operations/transactions', {
      waitUntil: 'domcontentloaded',
    });
    await page
      .waitForLoadState('networkidle', { timeout: 10_000 })
      .catch(() => {
        /* background polling may keep the network busy */
      });

    const notFound = page.locator('text=/This page could not be found/i');
    await expect(notFound).toHaveCount(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page
      .waitForLoadState('networkidle', { timeout: 10_000 })
      .catch(() => {
        /* allow pending streaming requests */
      });

    const current = await prisma.transaction.count();
    expect(current).toBeGreaterThan(0);
    expect(current).toBeGreaterThanOrEqual(
      Math.max(0, baseline - DATA_DRIFT_TOLERANCE)
    );
  });

  test('no transactions missing auto-populated order dates', async () => {
    const missing = await prisma.transaction.count({
      where: {
        OR: [{ orderDate: null }, { orderDate: '' }],
      },
    });

    expect(missing).toBe(0);
  });

  test('shipment records persist', async ({ page }) => {
    const baseline = await prisma.shipment.count();

    await page.goto('/clothing/operations/shipments', {
      waitUntil: 'domcontentloaded',
    });
    await page
      .waitForLoadState('networkidle', { timeout: 10_000 })
      .catch(() => {});

    const current = await prisma.shipment.count();
    expect(current).toBeGreaterThanOrEqual(
      Math.max(0, baseline - DATA_DRIFT_TOLERANCE)
    );
  });
});
