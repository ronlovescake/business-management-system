import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
} from '@playwright/test';
import { waitForTransactionsContent } from './helpers/transactions';

type MockTransaction = {
  id: number;
  'Order Date': string;
  Customers: string;
  'Product Code': string;
  Quantity: number;
  'Unit Price': number;
  Discount: number;
  Adjustment: number;
  'Line Total': number;
  'Order Status': string;
  Notes: string;
  'Invoice Date': string;
  'Packed Date': string;
  'Shipment Code': string;
  version: number;
};

const ORDER_DATE_COL = 0;
const UNIT_PRICE_COL = 4;
const ORDER_STATUS_COL = 8;
const NOTES_COL = 9;

test.describe.configure({ timeout: 90000 });

test.describe('Handsontable grid interactions', () => {
  let mockStore: Awaited<ReturnType<typeof installTransactionsMocks>>;
  test.beforeEach(async ({ page }) => {
    mockStore = await installTransactionsMocks(page);

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

    await gotoTransactions(page);
  });

  test('supports keyboard navigation and grid search focus', async ({
    page,
  }) => {
    await clickGridCell(page, 0, ORDER_DATE_COL);
    await expect
      .poll(() => getCurrentCellCoordinates(page))
      .toMatchObject({
        row: 0,
        col: ORDER_DATE_COL,
      });

    await page.keyboard.press('Control+ArrowRight');
    await expect
      .poll(() => getCurrentCellCoordinates(page))
      .toMatchObject({
        row: 0,
        col: UNIT_PRICE_COL,
      });

    await page.keyboard.press('Control+ArrowLeft');
    await expect
      .poll(() => getCurrentCellCoordinates(page))
      .toMatchObject({
        row: 0,
        col: ORDER_DATE_COL,
      });

    await page.keyboard.press('Control+f');

    const searchInput = page
      .locator('input[placeholder*="Search transactions" i]')
      .first();
    await expect(searchInput).toBeFocused();
  });

  test('commits notes cell edits from the keyboard', async ({ page }) => {
    const noteValue = `pw-note-${Date.now()}`;

    await selectColumnOnFirstRow(page, NOTES_COL);
    await editSelectedCell(page, noteValue);
    await expect(page.getByText('Notes updated successfully')).toBeVisible();
    await expect
      .poll(() => getCurrentCellCoordinates(page))
      .toMatchObject({
        row: 0,
        col: NOTES_COL + 1,
      });
  });

  test('opens order status dropdown editing from the keyboard', async ({
    page,
  }) => {
    await selectColumnOnFirstRow(page, ORDER_STATUS_COL);
    await page.keyboard.press('Enter');

    const editor = page
      .locator(
        '.handsontableEditor textarea, textarea.handsontableInput, .handsontableInputHolder textarea'
      )
      .first();

    await expect(editor).toBeVisible({ timeout: 10000 });
  });

  test('retains ten individual pastes while a save is delayed and blocks payment entry', async ({
    page,
    context,
  }) => {
    await expect(
      page.getByRole('status').filter({ hasText: 'All changes saved' })
    ).toBeVisible();
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    mockStore.pauseWrites();
    await selectColumnOnFirstRow(page, NOTES_COL);
    for (let index = 1; index <= 10; index += 1) {
      await page.evaluate(
        (value) => navigator.clipboard.writeText(value),
        `Rapid paste ${index}`
      );
      await page.keyboard.press('Control+v');
      await expect(
        page.locator('.transactions-grid td.current').first()
      ).toHaveText(`Rapid paste ${index}`);
    }
    await expect(
      page.getByRole('button', { name: 'Record Payment' })
    ).toBeDisabled();
    expect(mockStore.maxActiveWrites()).toBe(1);
    mockStore.releaseWrites();
    await expect(
      page.getByRole('status').filter({ hasText: 'All changes saved' })
    ).toBeVisible();
    await expect(
      page.locator('.transactions-grid td.current').first()
    ).toHaveText('Rapid paste 10');
    expect(mockStore.savedNotes()).toBe('Rapid paste 10');
    expect(mockStore.maxActiveWrites()).toBe(1);
    await expect(
      page.getByRole('button', { name: 'Record Payment' })
    ).toBeEnabled();
  });

  for (const recovery of ['Refresh and Retry', 'Discard Drafts'] as const) {
    test(`retains failed drafts until ${recovery}`, async ({
      page,
      context,
    }) => {
      let writes = 0;
      await page.route('**/api/transactions', async (route) => {
        if (['PATCH', 'PUT'].includes(route.request().method())) {
          writes += 1;
          if (writes === 1) {
            await route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Simulated save failure' }),
            });
            return;
          }
        }
        await route.fallback();
      });
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await selectColumnOnFirstRow(page, NOTES_COL);
      await page.evaluate(() =>
        navigator.clipboard.writeText('Unsaved browser draft')
      );
      await page.keyboard.press('Control+v');
      await expect(page.getByRole('button', { name: recovery })).toBeVisible();
      await expect(
        page.locator('.transactions-grid td.current').first()
      ).toHaveText('Unsaved browser draft');
      await expect(
        page.getByRole('button', { name: 'Record Payment' })
      ).toBeDisabled();
      expect(writes).toBe(1);
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: recovery }).click();
      await expect(
        page.getByRole('status').filter({ hasText: 'All changes saved' })
      ).toBeVisible();
      const expected =
        recovery === 'Refresh and Retry'
          ? 'Unsaved browser draft'
          : 'Initial note';
      await expect(
        page.getByRole('gridcell', { name: expected, exact: true }).first()
      ).toBeVisible();
      expect(mockStore.savedNotes()).toBe(expected);
      expect(writes).toBe(recovery === 'Refresh and Retry' ? 2 : 1);
      await expect(
        page.getByRole('button', { name: 'Record Payment' })
      ).toBeEnabled();
    });
  }

  test('uses the same gap navigation on the products grid', async ({
    page,
  }) => {
    await page.goto('/clothing/operations/products');
    const firstRow = page.locator('.ht_master tbody tr').first();
    await expect(firstRow.locator('td').nth(0)).toHaveText('SHIP-001');
    await firstRow.locator('td').nth(0).click();
    await page.keyboard.press('Control+ArrowRight');
    await expect(page.locator('.ht_master td.current').first()).toHaveText(
      'Warehouse'
    );
    await page.keyboard.press('Control+ArrowLeft');
    await expect(firstRow.locator('td').nth(0)).toHaveClass(/current/);
  });
});

async function gotoTransactions(page: Page) {
  await page.goto('/clothing/operations/transactions', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
    /* network may stay active due to polling */
  });
  await waitForTransactionsContent(page, { timeout: 60000 });
  await expect(
    page.locator('.transactions-grid .ht_master table.htCore').first()
  ).toBeVisible();
}

function cellLocator(page: Page, row: number, col: number): Locator {
  return page
    .locator('.transactions-grid .ht_master tbody tr')
    .nth(row)
    .locator('td')
    .nth(col);
}

async function clickGridCell(page: Page, row: number, col: number) {
  const cell = cellLocator(page, row, col);
  await cell.scrollIntoViewIfNeeded();
  await cell.click();
}

async function selectColumnOnFirstRow(page: Page, targetCol: number) {
  await clickGridCell(page, 0, ORDER_DATE_COL);

  for (let col = ORDER_DATE_COL; col < targetCol; col += 1) {
    await page.keyboard.press('ArrowRight');
  }

  await expect
    .poll(() => getCurrentCellCoordinates(page))
    .toMatchObject({
      row: 0,
      col: targetCol,
    });
}

async function editSelectedCell(page: Page, value: string) {
  await page.keyboard.press('Enter');

  const editor = page
    .locator(
      '.handsontableEditor textarea, textarea.handsontableInput, .handsontableInputHolder textarea'
    )
    .first();

  await expect(editor).toBeVisible({ timeout: 10000 });
  await editor.press('Control+a');
  await editor.fill(value);
  await editor.press('Tab');
}

async function getCurrentCellCoordinates(page: Page) {
  return page.evaluate(() => {
    const root =
      document.querySelector('.transactions-grid') ??
      document.querySelector('.ht-theme-horizon');

    const currentCell = root?.querySelector('.ht_master tbody td.current');
    if (!currentCell) {
      return null;
    }

    const rowElement = currentCell.parentElement;
    const body = rowElement?.parentElement;
    const row =
      rowElement && body ? Array.from(body.children).indexOf(rowElement) : -1;
    const col = rowElement
      ? Array.from(rowElement.querySelectorAll('td')).indexOf(
          currentCell as HTMLTableCellElement
        )
      : -1;

    return {
      row,
      col,
      text: currentCell.textContent?.trim() ?? '',
      classes: currentCell.className,
    };
  });
}

async function installTransactionsMocks(page: Page) {
  let release: (() => void) | undefined;
  let gate: Promise<void> | undefined;
  let activeWrites = 0;
  let maxActiveWrites = 0;
  let transaction: MockTransaction = {
    id: 101,
    'Order Date': '2026-03-01',
    Customers: 'Mock Customer',
    'Product Code': 'SKU-001',
    Quantity: 4,
    'Unit Price': 125,
    Discount: 0,
    Adjustment: 0,
    'Line Total': 500,
    'Order Status': 'In Transit',
    Notes: 'Initial note',
    'Invoice Date': '',
    'Packed Date': '',
    'Shipment Code': 'SHIP-001',
    version: 1,
  };

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;
    const method = route.request().method();
    const isTransactionsEndpoint =
      pathname.endsWith('/transactions') && !pathname.includes('/payments');

    if (isTransactionsEndpoint && method === 'GET') {
      return fulfillJson(route, [transaction]);
    }

    if (isTransactionsEndpoint && method === 'PATCH') {
      activeWrites += 1;
      maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
      await gate;
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      transaction = {
        ...transaction,
        ...payload,
        id: transaction.id,
        version: transaction.version + 1,
      };
      await fulfillJson(route, transaction);
      activeWrites -= 1;
      return;
    }

    if (isTransactionsEndpoint && method === 'PUT') {
      activeWrites += 1;
      maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
      await gate;
      const payload = route.request().postDataJSON() as Array<
        Record<string, unknown>
      >;
      const update = payload.find((item) => Number(item.id) === transaction.id);
      if (update) {
        transaction = {
          ...transaction,
          ...update,
          id: transaction.id,
          version: transaction.version + 1,
        };
      }
      await fulfillJson(route, { count: update ? 1 : 0 });
      activeWrites -= 1;
      return;
    }

    if (pathname.endsWith('/customers') && method === 'GET') {
      return fulfillJson(route, [
        {
          id: 1,
          name: 'Mock Customer',
          'Customer Name': 'Mock Customer',
          'Business Name': 'Mock Shop',
          Facebook: 'https://m.me/mock-customer',
        },
      ]);
    }

    if (pathname.endsWith('/prices') && method === 'GET') {
      return fulfillJson(route, []);
    }

    if (pathname.endsWith('/products') && method === 'GET') {
      return fulfillJson(route, [
        {
          id: 11,
          productCode: 'SKU-001',
          'Product Code': 'SKU-001',
          shipmentCode: 'SHIP-001',
          'Shipment Code': 'SHIP-001',
          shipmentStatus: 'Warehouse',
          'Shipment Status': 'Warehouse',
        },
      ]);
    }

    if (pathname.endsWith('/operations/notifications') && method === 'GET') {
      return fulfillJson(route, []);
    }

    if (pathname.endsWith('/operations/notifications') && method === 'POST') {
      return fulfillJson(route, {
        id: 'mock-notification-1',
        category: 'transactions',
        user: 'Playwright',
        changes: 'Mock notification logged',
        metadata: null,
        createdAt: new Date().toISOString(),
        createdAtDate: 'Mar 28, 2026',
        createdAtTime: '12:00:00 PM',
      });
    }

    if (pathname.endsWith('/shipments') && method === 'GET') {
      return fulfillJson(route, []);
    }

    if (pathname.endsWith('/split-batches') && method === 'GET') {
      return fulfillJson(route, []);
    }

    if (pathname.endsWith('/settings/transactions') && method === 'GET') {
      return fulfillJson(route, {
        unitPriceReadOnly: false,
        lineTotalReadOnly: false,
        invoiceDateReadOnly: false,
        packedDateReadOnly: false,
        shipmentCodeReadOnly: false,
      });
    }

    if (
      pathname.endsWith('/operations/settings/change-log') &&
      method === 'GET'
    ) {
      return fulfillJson(route, {
        logs: [],
        pagination: {
          page: 1,
          limit: 200,
          total: 0,
          pages: 1,
        },
        filters: null,
      });
    }

    return route.continue();
  });
  return {
    pauseWrites: () => {
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    releaseWrites: () => {
      release?.();
      gate = undefined;
    },
    maxActiveWrites: () => maxActiveWrites,
    savedNotes: () => transaction.Notes,
  };
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
