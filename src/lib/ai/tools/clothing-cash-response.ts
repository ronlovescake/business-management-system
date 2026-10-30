import type { reconcileClothingCash } from './clothing-cash-reconciliation';

export type ClothingCashResult = Awaited<
  ReturnType<typeof reconcileClothingCash>
>;

export function isDirectClothingCashQuestion(question: string): boolean {
  return [
    'how much should our cash onhand at the moment on the balance sheet. can you check if it matches all the records and if not, find why',
    'check clothing cash reconciliation',
    'check clothing purchase posting completeness',
  ].includes(
    question
      .toLowerCase()
      .trim()
      .replace(/[?.!]+$/g, '')
  );
}

function cell(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '&#124;')
    .replace(/[\r\n]+/g, ' ')
    .replace(/([\\`*_\[\]])/g, '\\$1');
}
const money = (amount: number) =>
  `PHP ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function formatClothingCashCoverage(result: ClothingCashResult): string {
  const purchase = result.purchasePostingCoverage;
  const candidates = purchase.findings.filter(
    (entry) => entry.category === 'possible_unposted_paid_purchase'
  );
  const totals = purchase.categories.possible_unposted_paid_purchase;
  const rows = candidates.map((entry) => {
    const label = entry.productCode
      .toLowerCase()
      .includes(entry.productName.toLowerCase())
      ? entry.productCode
      : `${entry.productName} (${entry.productCode})`;
    return `| ${cell(label)} | ${cell(entry.shipmentStatus || 'Not assigned')} | ${cell(entry.shipmentCode || 'Not assigned')} | ${cell(entry.paymentMethod)} | ${money(entry.amount)} |`;
  });
  const components = result.cashComponentsBreakdown;
  return [
    '### Clothing - Recorded Combined Funds And Posting Checks',
    `${result.bookCashIsProvisional ? '**Provisional recorded funds (required source coverage is incomplete):**' : '**Recorded combined funds:**'} ${money(result.recordedBookCashEquivalents)}. Includes physical Cash, Bank and GCash/e-wallet records; not an independently verified statement or count.`,
    `As of ${cell(result.asOf)}; cutover ${cell(result.cutoverDate)}.`,
    result.actualCashAmount === null
      ? 'No comparison amount was passed into this calculation; only recorded funds and posting coverage are shown. No shortage or surplus is asserted.'
      : `Compared with the amount you provided (${money(result.actualCashAmount)}), the recorded variance is ${money(result.varianceVsBookCashEquivalents ?? 0)}. This alone does not establish missing money.`,
    '**Recorded cash components**',
    [
      `- Opening: ${money(components.openingCashEquivalents)}`,
      `- Customer receipts: ${money(components.customerPaymentsCashEquivalents)}`,
      `- Legacy receipt fallback: ${money(components.legacyAdjustmentsCash)}`,
      `- Paid expenses: ${money(-components.paidExpensesOutflow)}`,
      `- Refunds: ${money(-components.refundsPaidOutflow)}`,
      `- Journal net cash: ${money(components.manualJournalNetCash)}`,
      `- Posted transit build-up net cash: ${money(components.postedTransitNetCash)}`,
      `- Posted reclassification net cash: ${money(components.postedReclassificationNetCash)}`,
    ].join('\n'),
    '**Possible omitted paid purchase postings**',
    `Found ${totals?.count ?? 0} candidate products totalling ${money(purchase.possibleUnpostedCashOutflows)}. Showing ${candidates.length} candidate rows. These are posting-coverage candidates, not verified lost funds.`,
    rows.length
      ? [
          '| Product | Shipment Status | Shipment | Paid Method | Grand Total |',
          '| --- | --- | --- | --- | ---: |',
          ...rows,
        ].join('\n')
      : 'No candidates established by the completed checks. This is not a claim that every possible posting was verified.',
    `Conditional combined balance: ${money(result.conditionalScenario.conditionalCombinedBalance)}. ${result.conditionalScenario.caveat}`,
    '**Source coverage**',
    [
      '| Source | Status | Scanned Rows |',
      '| --- | --- | ---: |',
      ...purchase.coverage.map(
        (entry) =>
          `| ${cell(entry.source)} | ${entry.status} | ${entry.scannedRows} |`
      ),
    ].join('\n'),
    `Posted transit cash check: ${result.postedTransitCashCheck.status}; posted reclassification cash check: ${result.postedReclassificationCashCheck.status}. Purchase coverage: ${purchase.status}${purchase.hasMoreFindings ? '; additional findings were truncated from the detail list' : ''}.`,
    '**Other review categories (not additional missing-cash deductions)**',
    Object.entries(purchase.categories)
      .filter(([category]) => category !== 'possible_unposted_paid_purchase')
      .map(
        ([category, total]) =>
          `- ${cell(category)}: ${total.count} products, ${money(total.amount)}.`
      )
      .join('\n') || 'No other categories returned.',
    `Other scoped scans: ${result.potentialCulprits.duplicateOrOverpaidOrders.length} recent order-anomaly samples; ${result.potentialCulprits.approvedButUnpaidExpenses.length} approved/unpaid expense samples; ${result.potentialCulprits.pendingCancellationRefunds.length} pending refund samples. Unpaid/unposted obligations are not assumed to be cash already spent.`,
    '**Not verified**',
    purchase.notVerified.map((entry) => `- ${entry}`).join('\n'),
    purchase.warning,
    '[Review Products](/clothing/operations/products) | [Review Accounting](/clothing/accounting).',
  ].join('\n\n');
}
