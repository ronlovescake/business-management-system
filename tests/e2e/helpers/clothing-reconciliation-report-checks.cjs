const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { expect: playwrightExpect } = require('@playwright/test');
const Papa = require('papaparse');

const expect = playwrightExpect.configure({ timeout: 30000 });
const currency = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

async function verifyRefundVisibility({
  page,
  context,
  url,
  today,
  customer,
  pending,
  paid,
  checks,
  artifacts,
}) {
  const response = await context.request.get(
    `${url}/api/customers/refund-pending?asOf=${today}&from=2026-10-01`
  );
  assert.equal(response.status(), 200);
  const summary = (await response.json()).data;
  assert.equal(summary.pendingAmount, pending);
  assert.equal(summary.transactionCount, pending ? 1 : 0);
  assert.equal(summary.paidApprovedRefundAmount, paid);
  for (const route of [
    '/clothing/operations/transactions',
    '/clothing/accounting',
    '/clothing/operations/business-intelligence',
  ]) {
    await page.goto(`${url}${route}`, { timeout: 120000 });
    const card = page.getByRole('button', {
      name: 'Refund Pending',
      exact: true,
    });
    await expect(card).toContainText(currency.format(pending));
    const header = page.getByRole('button', { name: /^Refund Pending:/ });
    await expect(header).toHaveAccessibleName(
      `Refund Pending: ${currency.format(pending)} | ${pending ? 1 : 0} orders`
    );
    if (route.endsWith('/transactions')) {
      for (const trigger of [card, header]) {
        await trigger.click();
        const dialog = page.getByRole('dialog', { name: /^refund pending$/i });
        if (pending) {
          const row = dialog.getByRole('row').filter({
            has: page.getByRole('link', {
              name: customer.customerName,
              exact: true,
            }),
          });
          await expect(row.getByRole('cell').nth(3)).toHaveText(
            currency.format(pending)
          );
        } else {
          await expect(
            dialog.getByText('No approved refunds pending.', { exact: true })
          ).toBeVisible();
        }
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
      }
    } else {
      const paidSummary = page
        .getByText('Approved Refunds Paid', { exact: true })
        .locator('..');
      await expect(paidSummary).toContainText(currency.format(paid));
      await expect(paidSummary).toContainText('Approved Retained Deposits');
      if (route.endsWith('/business-intelligence')) {
        if (paid)
          await expect(
            page.getByRole('table', {
              name: 'Approved refunds paid by month',
              exact: true,
            })
          ).toContainText(currency.format(paid));
        else
          await expect(
            page.getByText('No approved refund payouts in this period.', {
              exact: true,
            })
          ).toBeVisible();
      }
    }
    await page.screenshot({
      path: path.join(
        artifacts,
        `X05-${pending}-${route.split('/').at(-1)}.png`
      ),
      fullPage: true,
    });
  }
  checks.push(
    `X05 reminders/dashboard/BI: actual card/header lists, pending ${pending}, paid ${paid}, order count and BI paid trend agree with the shared dated obligation; no approval-only cash payment`
  );
}

async function verifyLedgerFilters({
  page,
  context,
  client,
  url,
  today,
  checks,
  artifacts,
}) {
  const manualEntry = {
    date: '2026-09-30',
    ref: `RECON-PRIOR-${randomUUID()}`,
    debitAccount: 'Cash',
    creditAccount: 'Equity',
    amount: 50,
    description: 'Owned prior-period fixture',
  };
  const created = await context.request.post(
    `${url}/api/accounting/manual-journal`,
    { data: manualEntry }
  );
  assert.equal(
    created.status(),
    200,
    'X06: administrator can create a manual journal entry'
  );
  const sourceId = (await created.json()).data.entry.sourceId;
  assert.equal(typeof sourceId, 'string');
  assert.ok(sourceId);
  try {
    assert.equal(
      await client.clothingAccountingJournalLine.count({
        where: { sourceType: 'MANUAL', sourceId, deletedAt: null },
      }),
      2
    );
    const updated = await context.request.put(
      `${url}/api/accounting/manual-journal`,
      {
        data: {
          ...manualEntry,
          sourceId,
          description: 'Owned prior-period fixture edited through API',
        },
      }
    );
    assert.equal(
      updated.status(),
      200,
      'X06: administrator can edit its eligible manual entry'
    );
    assert.equal(
      await client.clothingAccountingJournalLine.count({
        where: { sourceType: 'MANUAL', sourceId, deletedAt: null },
      }),
      2
    );
    const response = await context.request.get(
      `${url}/api/accounting/ledger?from=2026-10-01&to=${today}`
    );
    assert.equal(response.status(), 200);
    const ledger = (await response.json()).data;
    assert.equal(ledger.openingBalances.Cash, 50);
    assert.equal(ledger.closingBalances.Cash, 550);
    assert.equal(ledger.closingBalances.Equity, -50);
    await page.goto(`${url}/clothing/accounting/ledger`, { timeout: 120000 });
    const account = page.getByPlaceholder('Filter by account', { exact: true });
    await account.click();
    await page.getByRole('option', { name: 'Cash', exact: true }).click();
    const balances = page.locator('[aria-label="Account balances"]');
    await expect(balances).toContainText(
      `Brought Forward: ${currency.format(50)}`
    );
    await expect(balances).toContainText(
      `Closing Balance: ${currency.format(550)}`
    );
    const search = page.getByPlaceholder('Search ledger...', { exact: true });
    await search.fill('NO-MATCH-RECONCILIATION');
    await expect(
      page.getByText('No ledger entries found', { exact: true })
    ).toBeVisible();
    await expect(balances).toContainText(
      `Closing Balance: ${currency.format(550)}`
    );
    await search.fill('Reservation Deposit');
    await expect(balances).toContainText(
      `Closing Balance: ${currency.format(550)}`
    );
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const download = await downloaded;
    const exportPath = path.join(artifacts, 'X05-filtered-ledger.csv');
    await download.saveAs(exportPath);
    const parsed = Papa.parse(fs.readFileSync(exportPath, 'utf8'), {
      header: true,
      skipEmptyLines: true,
    });
    assert.deepEqual(parsed.errors, []);
    const expected = ledger.entries.filter(
      (entry) =>
        entry.account === 'Cash' &&
        entry.description.includes('Reservation Deposit')
    );
    assert.equal(parsed.data.length, expected.length);
    assert.equal(parsed.data.length, 1);
    assert.equal(parsed.data[0].Account, 'Cash');
    assert.equal(Number(parsed.data[0].Balance), expected[0].balance);
    assert.equal(Number(parsed.data[0].Balance), 250);
    await search.fill('');
    await account.click();
    await page.getByRole('option', { name: 'Equity', exact: true }).click();
    await expect(balances).toContainText(
      `Period Movement: ${currency.format(0)}`
    );
    await expect(balances).toContainText(
      `Closing Balance: ${currency.format(-50)}`
    );
    await account.click();
    await page.getByRole('option', { name: 'Cash', exact: true }).click();
    const period = page.getByPlaceholder('Select period', { exact: true });
    await period.click();
    await page.getByRole('option', { name: 'Last Month', exact: true }).click();
    await expect(balances).toContainText(
      `Closing Balance: ${currency.format(50)}`
    );
    await period.click();
    await page.getByRole('option', { name: 'This Month', exact: true }).click();
    await expect(balances).toContainText(
      `Closing Balance: ${currency.format(550)}`
    );
    await page.screenshot({
      path: path.join(artifacts, 'X05-ledger-period-balance.png'),
      fullPage: true,
    });
    checks.push(
      'X05 ledger: real date/account/search filters and downloaded CSV preserve authoritative brought-forward/closing balances; prior-only Equity remains selectable; filtered receipt balance is 250, full Cash closing remains 550'
    );
    const deleted = await context.request.delete(
      `${url}/api/accounting/manual-journal?sourceId=${encodeURIComponent(sourceId)}`
    );
    assert.equal(
      deleted.status(),
      200,
      'X06: administrator can soft-delete the owned manual fixture'
    );
    assert.equal(
      await client.clothingAccountingJournalLine.count({
        where: { sourceType: 'MANUAL', sourceId, deletedAt: null },
      }),
      0
    );
    assert.equal(
      await client.clothingAccountingJournalLine.count({
        where: { sourceType: 'MANUAL', sourceId, deletedAt: { not: null } },
      }),
      2
    );
    checks.push(
      'X06 administrator manual entry: real POST/PUT/DELETE create exactly two balanced owned lines, edit without duplication and preserve both soft-deleted lines; corresponding anonymous/USER writes reject in the separate role matrix'
    );
  } finally {
    await client.clothingAccountingJournalLine.deleteMany({
      where: { sourceType: 'MANUAL', sourceId },
    });
  }
  await verifyJournalFilters({ page, context, url, today, checks, artifacts });
  await verifyMissingValuation({
    page,
    context,
    client,
    url,
    today,
    checks,
    artifacts,
  });
}

async function verifyJournalFilters({
  page,
  context,
  url,
  today,
  checks,
  artifacts,
}) {
  const response = await context.request.get(
    `${url}/api/accounting/journal?from=2026-10-01&to=${today}`
  );
  assert.equal(response.status(), 200);
  const journal = (await response.json()).data;
  await page.goto(`${url}/clothing/accounting/journal`, { timeout: 120000 });
  const period = page.getByPlaceholder('Select period', { exact: true });
  await period.click();
  await page.getByRole('option', { name: 'This Month', exact: true }).click();
  const debits = page.getByText('Total Debits', { exact: true }).locator('..');
  const credits = page
    .getByText('Total Credits', { exact: true })
    .locator('..');
  await expect(debits).toContainText(
    currency.format(journal.stats.totalDebits)
  );
  await expect(credits).toContainText(
    currency.format(journal.stats.totalCredits)
  );
  await page.getByPlaceholder('Filter by account', { exact: true }).click();
  await page.getByRole('option', { name: 'Cash', exact: true }).click();
  const search = page.getByPlaceholder('Search journal...', { exact: true });
  await search.fill('Reservation Deposit');
  await expect(
    page.getByRole('cell', { name: 'Cash', exact: true }).first()
  ).toBeVisible();
  const expected = journal.entries.filter(
    (entry) =>
      entry.account === 'Cash' &&
      entry.description.includes('Reservation Deposit')
  );
  await expect(debits).toContainText(
    currency.format(expected.reduce((sum, entry) => sum + entry.debit, 0))
  );
  await expect(credits).toContainText(
    currency.format(expected.reduce((sum, entry) => sum + entry.credit, 0))
  );
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloaded;
  const exportPath = path.join(artifacts, 'X05-filtered-journal.csv');
  await download.saveAs(exportPath);
  const parsed = Papa.parse(fs.readFileSync(exportPath, 'utf8'), {
    header: true,
    skipEmptyLines: true,
  });
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.data.length, expected.length);
  assert.equal(parsed.data.length, 1);
  for (const [index, row] of parsed.data.entries()) {
    assert.equal(row.Account, expected[index].account);
    assert.equal(row.Ref, expected[index].ref);
    assert.equal(Number(row.Debit), expected[index].debit);
    assert.equal(Number(row.Credit), expected[index].credit);
  }
  await search.fill('NO-MATCH-RECONCILIATION');
  await expect(
    page.getByRole('cell', { name: 'Cash', exact: true })
  ).toHaveCount(0);
  await expect(debits).toContainText(currency.format(0));
  await expect(credits).toContainText(currency.format(0));
  await search.fill('');
  await page.getByPlaceholder('Filter by account', { exact: true }).click();
  await page.getByRole('option', { name: 'All', exact: true }).click();
  await period.click();
  await page.getByRole('option', { name: 'Last Month', exact: true }).click();
  await expect(debits).toContainText(currency.format(0));
  await expect(credits).toContainText(currency.format(0));
  await period.click();
  await page.getByRole('option', { name: 'This Month', exact: true }).click();
  await expect(debits).toContainText(
    currency.format(journal.stats.totalDebits)
  );
  await page.screenshot({
    path: path.join(artifacts, 'X05-journal-period-totals.png'),
    fullPage: true,
  });
  checks.push(
    'X05 journal: actual period/account/search controls and downloaded CSV match dated API rows; cards intentionally total the visible filtered subset, unlike Ledger closing balances; clearing filters/date changes restores authoritative period totals'
  );
}

async function verifyMissingValuation({
  page,
  context,
  client,
  url,
  today,
  checks,
  artifacts,
}) {
  const { snapshot } = require('./clothing-reconciliation-atomicity.cjs');
  const original = await snapshot(client);
  const shipment = await client.shipment.create({
    data: {
      shipmentCode: 'RECON-MISSING-COST',
      shipmentStatus: 'Delivered',
      dateDelivered: today,
    },
  });
  const product = await client.product.create({
    data: {
      product: 'Owned unpriced valuation fixture',
      productCode: shipment.shipmentCode,
      shipmentCode: shipment.shipmentCode,
      quantity: 1,
      unitPrice: 0,
      exchangeRates: 1,
      grandTotal: 0,
      cogs: 0,
      payment: 'Paid',
      paymentMethod: 'CASH',
      postingDate: today,
    },
  });
  try {
    await client.inventoryMovement.createMany({
      data: [
        {
          productId: product.id,
          productCode: product.productCode,
          quantity: 1,
          fromBucket: 'opening_inventory',
          toBucket: 'sellable',
          movementSource: 'manual',
        },
        {
          productId: product.id,
          productCode: product.productCode,
          quantity: 1,
          fromBucket: 'sellable',
          toBucket: 'sold',
          movementSource: 'manual',
        },
      ],
    });
    const response = await context.request.get(
      `${url}/api/accounting/inventory-valuation?from=2026-10-01&to=${today}`
    );
    assert.equal(response.status(), 200);
    const valuation = (await response.json()).data;
    assert.equal(
      valuation.complete,
      false,
      'X05: unknown cost must not be certified complete'
    );
    assert.ok(
      valuation.issues.some(
        (issue) => issue.productCode === product.productCode
      )
    );
    for (const route of [
      '/clothing/accounting/profit-loss',
      '/clothing/accounting',
      '/clothing/operations/business-intelligence',
    ]) {
      await page.goto(`${url}${route}`, { timeout: 120000 });
      const notice = page
        .getByRole('alert')
        .filter({ hasText: 'Profit Incomplete' });
      await expect(notice).toBeVisible();
      await expect(notice).toContainText(product.productCode);
      await expect(notice).toContainText('Cost unknown');
      await page.screenshot({
        path: path.join(
          artifacts,
          `X05-missing-cost-${route.split('/').at(-1)}.png`
        ),
        fullPage: true,
      });
    }
    assert.equal(
      await client.clothingFinancialRequest.count({
        where: { operation: 'INVENTORY_ZERO_COST_CONFIRMATION' },
      }),
      0
    );
  } finally {
    await client.inventoryMovement.deleteMany({
      where: { productId: product.id },
    });
    await client.product.delete({ where: { id: product.id } });
    await client.shipment.delete({ where: { id: shipment.id } });
  }
  assert.deepEqual(
    await snapshot(client),
    original,
    'X05: missing-cost read/review neither confirms zero value nor mutates existing financial history'
  );
  checks.push(
    'X05 valuation visibility: owned unpriced sold unit makes valuation.complete false and Profit Incomplete/Cost unknown visible on actual P&L, Accounting and BI pages; no zero-cost confirmation or invented valuation; only owned fixture removed'
  );
}

async function verifyExpenseReconciliation({
  page,
  context,
  client,
  url,
  today,
  checks,
  artifacts,
  reports,
  net,
  findings,
}) {
  const prefix = `RECON-EXPENSE-${randomUUID()}`;
  const original = await reports('expenses-opening');
  const originalExpenses = await client.expense.findMany({
    orderBy: { id: 'asc' },
  });
  try {
    const expensesLoaded = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/expenses') &&
        response.request().method() === 'GET'
    );
    await page.goto(`${url}/clothing/accounting/expenses`, { timeout: 120000 });
    assert.equal((await expensesLoaded).status(), 200);
    await page
      .getByRole('button', { name: 'Add Expense', exact: true })
      .click();
    const dialog = page.getByRole('dialog', {
      name: /^add clothing operations expense$/i,
    });
    await dialog.getByLabel('Category', { exact: false }).click();
    await page.getByRole('option', { name: 'Fuel', exact: true }).click();
    await dialog.getByLabel('Amount', { exact: false }).fill('100');
    await dialog
      .getByLabel('Description', { exact: false })
      .fill(`${prefix} cash lifecycle`);
    await dialog
      .getByRole('button', { name: 'Add Expense', exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(() =>
        client.expense.count({
          where: { description: `${prefix} cash lifecycle` },
        })
      )
      .toBe(1);
    const expense = await client.expense.findFirstOrThrow({
      where: { description: `${prefix} cash lifecycle` },
    });
    assert.equal(expense.date, today);
    assert.equal(expense.status, 'pending');
    assert.deepEqual(
      await reports('expenses-pending'),
      original,
      'Pending expense must not post'
    );
    const row = page
      .getByRole('row')
      .filter({ has: page.getByText(expense.description, { exact: true }) });
    await row.getByRole('button', { name: /^Approve expense/i }).click();
    await expect
      .poll(
        async () =>
          (
            await client.expense.findUniqueOrThrow({
              where: { id: expense.id },
            })
          ).status
      )
      .toBe('approved');
    const approved = await reports('expenses-approved');
    assert.equal(
      net(approved.ledger.entries, 'Cash'),
      net(original.ledger.entries, 'Cash')
    );
    assert.equal(
      net(approved.ledger.entries, 'Accounts Payable') -
        net(original.ledger.entries, 'Accounts Payable'),
      -100
    );
    assert.equal(
      approved.profit.stats.expenseTotal - original.profit.stats.expenseTotal,
      100
    );
    assert.equal(approved.balance.stats.assets, original.balance.stats.assets);
    assert.equal(
      approved.balance.stats.liabilities - original.balance.stats.liabilities,
      -100
    );
    const paid = await context.request.patch(`${url}/api/expenses`, {
      data: { id: expense.id, status: 'paid', paymentMethod: 'CASH' },
    });
    assert.equal(paid.status(), 200);
    const cashPaid = await reports('expenses-paid-cash');
    assert.equal(
      net(cashPaid.ledger.entries, 'Cash') -
        net(original.ledger.entries, 'Cash'),
      -100
    );
    assert.equal(
      net(cashPaid.ledger.entries, 'Accounts Payable'),
      net(original.ledger.entries, 'Accounts Payable')
    );
    assert.equal(
      cashPaid.profit.stats.expenseTotal - original.profit.stats.expenseTotal,
      100
    );
    assert.equal(
      cashPaid.balance.stats.assets - original.balance.stats.assets,
      -100
    );
    assert.equal(
      cashPaid.balance.stats.liabilities,
      original.balance.stats.liabilities
    );
    const imported = await context.request.post(`${url}/api/expenses`, {
      data: [
        {
          date: today,
          amount: 40,
          description: `${prefix} card`,
          category: 'Fuel',
          status: 'paid',
          paymentMethod: 'CARD',
        },
        {
          date: today,
          amount: 50,
          description: `${prefix} pending`,
          category: 'Fuel',
          status: 'pending',
        },
        {
          date: today,
          amount: 60,
          description: `${prefix} rejected`,
          category: 'Fuel',
          status: 'rejected',
        },
      ],
    });
    assert.equal(imported.status(), 201);
    const final = await reports('expenses-cash-card-pending-rejected');
    assert.equal(
      net(final.ledger.entries, 'Cash') - net(original.ledger.entries, 'Cash'),
      -100
    );
    assert.equal(
      net(final.ledger.entries, 'Credit Card Payable') -
        net(original.ledger.entries, 'Credit Card Payable'),
      -40
    );
    assert.equal(
      final.profit.stats.expenseTotal - original.profit.stats.expenseTotal,
      140
    );
    assert.equal(
      final.profit.stats.netProfit - original.profit.stats.netProfit,
      -140
    );
    assert.equal(
      final.balance.stats.assets - original.balance.stats.assets,
      -100
    );
    assert.equal(
      final.balance.stats.liabilities - original.balance.stats.liabilities,
      -40
    );
    const detailExpenseTotal = (report) =>
      report.details.rows
        .filter((entry) => entry.type === 'Expense')
        .reduce((sum, entry) => sum + entry.amount, 0);
    assert.equal(detailExpenseTotal(final) - detailExpenseTotal(original), 140);
    for (const account of [
      'Fuel',
      'Accounts Payable',
      'Credit Card Payable',
      'Cash',
    ])
      assert.equal(
        net(final.journal.entries, account),
        net(final.ledger.entries, account)
      );
    await page.reload();
    await page.getByPlaceholder(/search/i).fill(prefix);
    for (const suffix of ['cash lifecycle', 'card', 'pending', 'rejected'])
      await expect(
        page.getByText(`${prefix} ${suffix}`, { exact: true })
      ).toBeVisible();
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: /export/i }).click();
    const download = await downloaded;
    const exportPath = path.join(artifacts, 'expenses-filtered.csv');
    await download.saveAs(exportPath);
    const parsed = Papa.parse(fs.readFileSync(exportPath, 'utf8'), {
      header: true,
      skipEmptyLines: true,
    });
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.data.length, 4);
    assert.equal(
      parsed.data.reduce(
        (sum, expenseRow) => sum + Number(expenseRow.Amount),
        0
      ),
      250
    );
    await page.screenshot({
      path: path.join(artifacts, 'expenses-statuses.png'),
      fullPage: true,
    });
    await verifyProfitAndBalanceViews({
      page,
      url,
      expected: final,
      checks,
      artifacts,
    });
    checks.push(
      'Expenses: real UI pending 100 posts nothing; UI approval accrues payable 100 without cash; paid Cash reduces Cash 100 without a second expense; paid CARD 40 creates card payable; pending/rejected 110 appear in filtered CSV total 250 but not financial expense 140; Journal/Ledger/P&L summary/details/Balance Sheet bridges agree'
    );
    const historicalBalance = async () => {
      const response = await context.request.get(
        `${url}/api/accounting/balance-sheet?asOf=2026-09-30`
      );
      assert.equal(response.status(), 200);
      return (await response.json()).data;
    };
    const pastOpening = await historicalBalance();
    const historicalDescription = `${prefix} historical settlement risk`;
    assert.equal(
      (
        await context.request.post(`${url}/api/expenses`, {
          data: {
            date: '2026-09-30',
            amount: 25,
            description: historicalDescription,
            category: 'Fuel',
            status: 'approved',
            paymentMethod: 'CASH',
          },
        })
      ).status(),
      201
    );
    const historicalExpense = await client.expense.findFirstOrThrow({
      where: { description: historicalDescription },
    });
    const pastApproved = await historicalBalance();
    assert.equal(pastApproved.stats.assets, pastOpening.stats.assets);
    assert.equal(
      pastApproved.stats.liabilities - pastOpening.stats.liabilities,
      -25
    );
    assert.equal(
      (
        await context.request.patch(`${url}/api/expenses`, {
          data: {
            id: historicalExpense.id,
            status: 'paid',
            paymentMethod: 'CASH',
          },
        })
      ).status(),
      200
    );
    const pastAfterCurrentSettlement = await historicalBalance();
    assert.equal(
      pastAfterCurrentSettlement.stats.assets - pastApproved.stats.assets,
      -25,
      'Reproduced gap: current settlement rewrites prior-period cash'
    );
    assert.equal(
      pastAfterCurrentSettlement.stats.liabilities -
        pastApproved.stats.liabilities,
      25
    );
    fs.writeFileSync(
      path.join(artifacts, 'expense-historical-settlement-finding.json'),
      JSON.stringify(
        { pastOpening, pastApproved, pastAfterCurrentSettlement },
        null,
        2
      )
    );
    findings.push({
      id: 'EXP-HISTORY-01',
      severity: 'high',
      status: 'unresolved',
      expected:
        'A later actual settlement must not move cash in an earlier as-of statement.',
      actual:
        'PATCH approved-to-paid today reclassifies the original 2026-09-30 payable as Cash on that original date; the September statement loses 25 Cash and 25 payable while still balancing.',
      evidence: 'expense-historical-settlement-finding.json',
      boundary:
        'Expense.date/status and getExpenseCreditAccount; separate actual settlement event/date is not represented.',
      action:
        'Accounting owner must approve a dated settlement/correction design before remediation; no existing business records changed.',
    });
    const deleted = await context.request.delete(
      `${url}/api/expenses/${historicalExpense.id}`
    );
    assert.equal(deleted.status(), 200);
    assert.ok((await deleted.json()).expense.deletedAt);
    assert.equal(
      (
        await context.request.get(`${url}/api/expenses/${historicalExpense.id}`)
      ).status(),
      404
    );
    const pastAfterPaidDeletion = await historicalBalance();
    assert.deepEqual(
      pastAfterPaidDeletion,
      pastOpening,
      'Reproduced gap: deleting paid expense erases its earlier statement effect'
    );
    fs.writeFileSync(
      path.join(artifacts, 'expense-paid-deletion-finding.json'),
      JSON.stringify(
        { pastAfterCurrentSettlement, pastAfterPaidDeletion },
        null,
        2
      )
    );
    findings.push({
      id: 'EXP-HISTORY-02',
      severity: 'high',
      status: 'unresolved',
      expected:
        'A paid financial event must remain represented in historical statements; correction must be explicit and dated.',
      actual:
        'Single-expense DELETE accepts the paid September 25 expense and soft-deletes it; September Cash and equity return to their pre-expense values, with no dated reversal.',
      evidence: 'expense-paid-deletion-finding.json',
      boundary:
        'DELETE /api/expenses/[id] soft-deletes without a posted-status guard; reports derive expense effects from active rows.',
      action:
        'Accounting owner must approve paid-expense correction and reversal rules, including single/bulk/import writers; no existing business records changed.',
    });
  } finally {
    await client.expense.deleteMany({
      where: { description: { startsWith: prefix } },
    });
  }
  assert.deepEqual(
    await client.expense.findMany({ orderBy: { id: 'asc' } }),
    originalExpenses
  );
  assert.deepEqual(await reports('expenses-owned-fixtures-removed'), original);
  const {
    verifyInvestorReconciliation,
  } = require('./clothing-reconciliation-investors.cjs');
  await verifyInvestorReconciliation({
    context,
    client,
    url,
    today,
    reports,
    net,
    checks,
    verifyViews: (expected) =>
      verifyProfitAndBalanceViews({
        page,
        url,
        expected,
        checks,
        artifacts,
        category: 'Investor Return Expense',
        artifactPrefix: 'investor-',
      }),
  });
}

async function verifyProfitAndBalanceViews({
  page,
  url,
  expected,
  checks,
  artifacts,
  category = 'Fuel',
  artifactPrefix = '',
}) {
  const artifactName = (filename) => `${artifactPrefix}${filename}`;
  const stat = (title) =>
    page
      .getByText(title, { exact: true })
      .locator('..')
      .filter({ has: page.getByRole('heading', { level: 3 }) });
  const exportRows = async (label, filename) => {
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: label, exact: true }).click();
    const download = await downloaded;
    const exportPath = path.join(artifacts, artifactName(filename));
    await download.saveAs(exportPath);
    const parsed = Papa.parse(fs.readFileSync(exportPath, 'utf8'), {
      header: true,
      skipEmptyLines: true,
    });
    assert.deepEqual(parsed.errors, []);
    return parsed.data;
  };
  await page.goto(`${url}/clothing/accounting/profit-loss`, {
    timeout: 120000,
  });
  await page
    .getByRole('tabpanel', { name: 'Profit & Loss', exact: true })
    .getByPlaceholder('Select period', { exact: true })
    .click();
  await page.getByRole('option', { name: 'This Month', exact: true }).click();
  await expect(stat('Net Profit')).toContainText(
    currency.format(expected.profit.stats.netProfit)
  );
  await expect(stat('COGS')).toContainText(
    currency.format(expected.profit.stats.cogsTotal)
  );
  const summaryRows = await exportRows('Export', 'profit-loss-summary.csv');
  assert.deepEqual(
    summaryRows
      .map((row) => `${row.Category}:${row.Type}:${Number(row.Amount)}`)
      .sort(),
    expected.profit.rows
      .map((row) => `${row.category}:${row.type}:${row.amount}`)
      .sort()
  );
  assert.ok(summaryRows.every((row) => row['Valuation Status'] === 'Complete'));
  await page
    .getByPlaceholder('Search categories...', { exact: true })
    .fill(category);
  await expect(
    page.getByRole('cell', { name: category, exact: true })
  ).toBeVisible();
  const scopedProfit = expected.profit.rows
    .filter((row) => row.category === category)
    .reduce(
      (total, row) =>
        total + (row.type === 'Revenue' ? row.amount : -row.amount),
      0
    );
  await expect(stat('Net Profit')).toContainText(currency.format(scopedProfit));
  const fullPeriodExport = await exportRows(
    'Export',
    'profit-loss-while-filtered.csv'
  );
  assert.deepEqual(
    fullPeriodExport,
    summaryRows,
    'Current P&L export intentionally uses complete period rows, not the visible category filter'
  );
  await page.getByPlaceholder('Search categories...', { exact: true }).fill('');
  await page.getByRole('tab', { name: 'Details', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: category, exact: true })
  ).toHaveCount(
    expected.details.rows.filter((row) => row.category === category).length
  );
  const details = await exportRows('Export Details', 'profit-loss-details.csv');
  assert.equal(details.length, expected.details.rows.length);
  for (const type of ['Revenue', 'Expense'])
    assert.equal(
      details
        .filter((row) => row.Type === type)
        .reduce((sum, row) => sum + Number(row.Amount), 0),
      expected.details.rows
        .filter((row) => row.type === type)
        .reduce((sum, row) => sum + row.amount, 0)
    );
  await expect(stat('Net Profit')).toContainText(
    currency.format(expected.profit.stats.netProfit)
  );
  await page.screenshot({
    path: path.join(artifacts, artifactName('profit-loss-details.png')),
    fullPage: true,
  });
  await page.goto(`${url}/clothing/accounting/balance-sheet`, {
    timeout: 120000,
  });
  const assertCurrent = async () => {
    for (const [title, amount] of [
      ['Assets', expected.balance.stats.assets],
      ['Liabilities', -expected.balance.stats.liabilities],
      ['Equity', -expected.balance.stats.equity],
      ['Balance', expected.balance.stats.balance],
    ])
      await expect(stat(title)).toContainText(currency.format(amount));
  };
  await assertCurrent();
  await page
    .getByPlaceholder('Search accounts...', { exact: true })
    .fill('Cash');
  await assertCurrent();
  const cashRows = await exportRows('Export', 'balance-sheet-cash.csv');
  const cash = expected.balance.rows.find((row) => row.account === 'Cash');
  assert.equal(cashRows.length, 1);
  assert.equal(cashRows[0].Account, 'Cash');
  assert.equal(Number(cashRows[0].Amount), cash.amount);
  await page.getByPlaceholder('Search accounts...', { exact: true }).fill('');
  const asOf = page
    .getByRole('tabpanel', { name: 'Balance Sheet', exact: true })
    .getByPlaceholder('As of date', { exact: true });
  const currentLabel = await asOf.inputValue();
  await asOf.click();
  await page
    .getByRole('option', { name: 'December 31, 2025', exact: true })
    .click();
  await expect(stat('Assets')).toContainText(currency.format(0));
  await asOf.click();
  await page.getByRole('option', { name: currentLabel, exact: true }).click();
  await assertCurrent();
  await page.screenshot({
    path: path.join(artifacts, artifactName('balance-sheet-current.png')),
    fullPage: true,
  });
  checks.push(
    `P&L/Balance Sheet UI: actual summary/detail CSV amounts match report APIs, complete valuation is exported explicitly, ${category} filter shows ${scopedProfit} scoped profit while P&L export retains complete period rows; Balance Sheet stat signs/equation and filtered Cash CSV agree; historical/current as-of switching preserves totals`
  );
}

module.exports = {
  verifyMissingValuation,
  verifyRefundVisibility,
  verifyLedgerFilters,
  verifyExpenseReconciliation,
};
