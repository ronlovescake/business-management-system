const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function verifyInvestorReconciliation({
  context,
  client,
  url,
  today,
  reports,
  net,
  checks,
  verifyViews,
}) {
  const prefix = `RECON-INVESTOR-${randomUUID()}`;
  const original = await reports('investor-opening');
  let investorId;
  let agreementId;
  let paymentId;
  const post = (data) =>
    context.request.post(`${url}/api/clothing/investors`, { data });
  try {
    const investor = await post({ kind: 'investor', data: { name: prefix } });
    assert.equal(investor.status(), 201);
    investorId = (await investor.json()).id;
    const agreement = await post({
      kind: 'agreement',
      data: {
        investorId,
        reference: `${prefix}-agreement`,
        effectiveDate: '2026-01-25',
        principal: '1000.00',
        monthlyRateBps: 500,
      },
    });
    assert.equal(agreement.status(), 201);
    agreementId = (await agreement.json()).id;
    assert.deepEqual(await reports('investor-agreement-unfunded'), original);
    const fundingData = { kind: 'funding', data: { agreementId, date: today } };
    assert.equal((await post(fundingData)).status(), 201);
    const funded = await reports('investor-funded');
    assert.equal(
      net(funded.ledger.entries, 'Cash') - net(original.ledger.entries, 'Cash'),
      1000
    );
    assert.equal(
      funded.balance.stats.assets - original.balance.stats.assets,
      1000
    );
    assert.equal(
      funded.balance.stats.liabilities - original.balance.stats.liabilities,
      -1000
    );
    assert.deepEqual(funded.profit, original.profit);
    assert.deepEqual(funded.details, original.details);
    const paymentData = {
      kind: 'payment',
      data: { agreementId, month: 9, amount: '50.00', paidDate: today },
    };
    assert.equal(
      (
        await post({
          ...paymentData,
          data: { ...paymentData.data, amount: '49.00' },
        })
      ).status(),
      400
    );
    assert.deepEqual(await reports('investor-invalid-partial-payout'), funded);
    const payment = await post(paymentData);
    assert.equal(payment.status(), 201);
    paymentId = (await payment.json()).id;
    const paid = await reports('investor-return-paid-once');
    assert.equal(
      net(paid.ledger.entries, 'Cash') - net(original.ledger.entries, 'Cash'),
      950
    );
    for (const report of ['journal', 'ledger']) {
      assert.equal(
        net(paid[report].entries, 'Investor Return Expense') -
          net(original[report].entries, 'Investor Return Expense'),
        50
      );
    }
    assert.equal(
      paid.profit.stats.expenseTotal - original.profit.stats.expenseTotal,
      50
    );
    assert.equal(
      paid.profit.stats.netProfit - original.profit.stats.netProfit,
      -50
    );
    const expenseTotal = (report) =>
      report.details.rows
        .filter((row) => row.type === 'Expense')
        .reduce((total, row) => total + row.amount, 0);
    assert.equal(expenseTotal(paid) - expenseTotal(original), 50);
    assert.equal(
      paid.details.rows.filter(
        (row) =>
          row.sourceId === paymentId &&
          row.category === 'Investor Return Expense'
      ).length,
      1
    );
    assert.equal(
      paid.balance.stats.assets - original.balance.stats.assets,
      950
    );
    assert.equal(
      paid.balance.stats.liabilities - original.balance.stats.liabilities,
      -1000
    );
    assert.equal(paid.balance.stats.equity - original.balance.stats.equity, 50);
    assert.equal(
      await client.clothingAccountingJournalLine.count({
        where: { sourceId: { in: [agreementId, paymentId] } },
      }),
      4
    );
    assert.equal((await post(fundingData)).status(), 409);
    assert.equal((await post(paymentData)).status(), 409);
    assert.deepEqual(await reports('investor-replays-rejected'), paid);
    await verifyViews(paid);
    checks.push(
      'Investor bridge: real authenticated profile/agreement creation posts nothing; funding 1000 creates Cash/liability without profit; actual full return 50 produces net Cash 950, unchanged principal liability 1000 and exactly one 50 P&L expense/detail; Journal/Ledger/BS agree; partial return and duplicate funding/payment reject without report changes'
    );
  } finally {
    const sourceIds = [agreementId, paymentId].filter(Boolean);
    if (sourceIds.length) {
      await client.clothingAccountingJournalLine.deleteMany({
        where: {
          sourceId: { in: sourceIds },
          sourceType: { in: ['INVESTOR_FUNDING', 'INVESTOR_RETURN'] },
        },
      });
    }
    if (agreementId) {
      await client.clothingInvestmentPayment.deleteMany({
        where: { agreementId },
      });
      await client.clothingInvestmentAgreement.delete({
        where: { id: agreementId },
      });
    }
    if (investorId)
      await client.clothingInvestor.delete({ where: { id: investorId } });
  }
  assert.deepEqual(await reports('investor-owned-fixtures-removed'), original);
}

module.exports = { verifyInvestorReconciliation };
