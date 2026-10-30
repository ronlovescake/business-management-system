import { prisma } from '@/lib/db';
import { normalizeAccountForReporting } from '@/lib/accounting/account-normalization';
import { getPaymentAccountForMethod } from '@/lib/accounting/payment-accounts';
import { parseDate } from '@/lib/accounting/date-utils';
import type { Prisma } from '@prisma/client';

type Row = Record<string, unknown> & { id: string | number };
type Scan = { status: 'checked' | 'partial' | 'not_checked'; rows: Row[] };

async function scanDeletedHistory(
  source: 'transit' | 'journal',
  asOf: Date
): Promise<Scan> {
  if (typeof prisma.$queryRaw !== 'function') {
    return { status: 'not_checked', rows: [] };
  }
  try {
    const rows =
      source === 'transit'
        ? await prisma.$queryRaw<
            Row[]
          >`SELECT id, "idempotencyKey", "postingDate" FROM public.clothing_inventory_transit_build_entries WHERE "deletedAt" IS NOT NULL AND "postingDate" <= ${asOf} ORDER BY id ASC LIMIT 20001`
        : await prisma.$queryRaw<
            Row[]
          >`SELECT id, "sourceType", "sourceId", "sourceLineKey", date FROM public.clothing_accounting_journal_lines WHERE "deletedAt" IS NOT NULL AND date <= ${asOf} ORDER BY id ASC LIMIT 20001`;
    return {
      status: rows.length > 20000 ? 'partial' : 'checked',
      rows: rows.slice(0, 20000),
    };
  } catch {
    return { status: 'not_checked', rows: [] };
  }
}

async function scan(
  modelName: string,
  where: Record<string, unknown>,
  cap: number,
  select?: Record<string, unknown>
): Promise<Scan> {
  const model = Reflect.get(prisma, modelName) as
    | { findMany?: (args: unknown) => Promise<Row[]> }
    | undefined;
  if (!model?.findMany) {
    return { status: 'not_checked', rows: [] };
  }
  try {
    const rows: Row[] = [];
    let cursor: Row['id'] | undefined;
    while (rows.length < cap) {
      const batch = await model.findMany({
        where,
        ...(select ? { select } : {}),
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
      });
      rows.push(...batch);
      if (batch.length < 500) {
        return { status: 'checked', rows };
      }
      cursor = batch[batch.length - 1].id;
    }
    return { status: 'partial', rows };
  } catch {
    return { status: 'not_checked', rows: [] };
  }
}

const productSelection = {
  id: true,
  product: true,
  productCode: true,
  shipmentCode: true,
  shipmentStatus: true,
  payment: true,
  paymentMethod: true,
  postingDate: true,
  orderDate: true,
  grandTotal: true,
  supplierFulfillmentStatus: true,
  supplierCreditAppliedAmount: true,
  issuedSupplierCredit: { select: { amount: true, postingDate: true } },
  supplierCreditApplication: { select: { amount: true, postingDate: true } },
} satisfies Prisma.ProductSelect;

export async function auditClothingPurchaseCoverage(cutover: Date, asOf: Date) {
  const [
    products,
    builds,
    deletedBuilds,
    journals,
    deletedJournals,
    transitOpenings,
  ] = await Promise.all([
    scan('product', { deletedAt: null }, 5000, productSelection),
    scan('clothingInventoryTransitBuildEntry', { deletedAt: null }, 20000),
    scanDeletedHistory('transit', asOf),
    scan(
      'clothingAccountingJournalLine',
      { deletedAt: null, date: { lte: asOf } },
      20000
    ),
    scanDeletedHistory('journal', asOf),
    scan(
      'clothingAccountingOpeningBalance',
      {
        deletedAt: null,
        account: 'Inventory in Transit',
        date: { gte: cutover, lte: asOf },
      },
      5000
    ),
  ]);
  const scans = {
    products,
    transitBuildSources: builds,
    deletedTransitHistory: deletedBuilds,
    journalSources: journals,
    deletedJournalHistory: deletedJournals,
    standaloneTransitOpenings: transitOpenings,
  };
  const coverage = Object.entries(scans).map(([source, result]) => ({
    source,
    status: result.status,
    scannedRows: result.rows.length,
  }));
  const unresolvedCoverage = coverage.some(
    (entry) => entry.status !== 'checked'
  );
  const findings: Array<{
    productCode: string;
    productName: string;
    shipmentCode: string;
    shipmentStatus: string;
    amount: number;
    paymentMethod: string;
    category: string;
    explanation: string;
    sourceLink: string;
  }> = [];
  const cashCandidates: Record<string, number> = { Cash: 0, Bank: 0, GCash: 0 };
  const add = (product: Row, category: string, explanation: string) =>
    findings.push({
      productCode: String(product.productCode ?? ''),
      productName: String(product.product ?? ''),
      shipmentCode: String(product.shipmentCode ?? ''),
      shipmentStatus: String(product.shipmentStatus ?? ''),
      amount: Number(product.grandTotal ?? 0),
      paymentMethod: String(product.paymentMethod ?? ''),
      category,
      explanation,
      sourceLink: '/clothing/operations/products',
    });
  for (const product of products.rows) {
    const amount = Number(product.grandTotal ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      continue;
    }
    const postingDate = parseDate(
      String(product.postingDate || product.orderDate || '')
    );
    const orderDate = parseDate(String(product.orderDate || ''));
    if (!postingDate) {
      add(
        product,
        'missing_date_review',
        'Posting/order date is invalid or absent; no current-period cash conclusion is possible.'
      );
      continue;
    }
    if (postingDate > asOf) {
      continue;
    }
    const prefix = `PRODUCT_TRANSIT_BUILD:${product.id}:`;
    const relatedBuilds = builds.rows.filter((row) =>
      String(row.idempotencyKey ?? '').startsWith(prefix)
    );
    const build = relatedBuilds.find(
      (row) => row.idempotencyKey === `${prefix}GRAND_TOTAL`
    );
    const linkedLines = journals.rows.filter(
      (row) =>
        row.sourceType === 'PRODUCT' &&
        String(row.sourceId) === String(product.id)
    );
    const deletedSource =
      deletedBuilds.rows.some((row) =>
        String(row.idempotencyKey ?? '').startsWith(prefix)
      ) ||
      deletedJournals.rows.some(
        (row) =>
          row.sourceType === 'PRODUCT' &&
          String(row.sourceId) === String(product.id)
      );
    const paid =
      String(product.payment ?? '')
        .trim()
        .toLowerCase() === 'paid';
    const fundingAccount = getPaymentAccountForMethod(
      String(product.paymentMethod ?? '')
    );
    const issued = product.issuedSupplierCredit as
      | { amount?: unknown }
      | null
      | undefined;
    const application = product.supplierCreditApplication as
      | { amount?: unknown }
      | null
      | undefined;
    const creditOwned =
      String(product.supplierFulfillmentStatus ?? '') === 'CREDIT_ISSUED' ||
      Number(product.supplierCreditAppliedAmount ?? 0) > 0 ||
      issued ||
      application;
    if (creditOwned) {
      add(
        product,
        'supplier_credit_review',
        'Supplier credit issue/application or product credit flag exists. Do not treat Grand Total as a new missing cash payment; verify the linked credit lifecycle.'
      );
      continue;
    }
    if (postingDate < cutover || (orderDate && orderDate < cutover)) {
      if (!build) {
        add(
          product,
          'legacy_opening_review',
          'Pre-cutover purchase may belong to opening funding. No new cash outflow is inferred.'
        );
      }
      continue;
    }
    if (deletedSource) {
      add(
        product,
        'deleted_source_review',
        'Deleted build-up or product journal history exists; do not recreate or infer a missing payment automatically.'
      );
      continue;
    }
    if (build) {
      const buildDate = new Date(String(build.postingDate));
      const openingFunded = String(build.creditAccount) === 'Opening Equity';
      const amountMismatch =
        Math.round(Number(build.amount) * 100) !== Math.round(amount * 100);
      const fundedAccount = String(build.creditAccount ?? '');
      if (
        amountMismatch ||
        String(build.debitAccount) !== 'Inventory in Transit' ||
        !Number.isFinite(buildDate.getTime()) ||
        buildDate > asOf
      ) {
        add(
          product,
          'build_source_mismatch',
          'Linked Grand Total posting has a different amount/account/date or is future-dated; review the saved source rather than descriptions.'
        );
      } else if (buildDate < cutover) {
        add(
          product,
          'legacy_source_review',
          'Linked acquisition source predates cutover. Review opening treatment; do not infer a new missing current-period cash purchase.'
        );
      } else if (openingFunded) {
        add(
          product,
          'opening_funded',
          'Linked source credits Opening Equity, not cash. No additional cash purchase is inferred.'
        );
      } else if (fundedAccount === 'Supplier Payable' && paid) {
        const debit = linkedLines.find(
          (line) => line.sourceLineKey === 'SUPPLIER_SETTLEMENT:debit'
        );
        const credit = linkedLines.find(
          (line) => line.sourceLineKey === 'SUPPLIER_SETTLEMENT:credit'
        );
        if (
          !debit ||
          !credit ||
          debit.account !== 'Supplier Payable' ||
          credit.account !== fundingAccount ||
          Number(debit.credit ?? 0) !== 0 ||
          Number(credit.debit ?? 0) !== 0 ||
          Math.round(Number(debit.debit) * 100) !==
            Math.round(Number(build.amount) * 100) ||
          Math.round(Number(credit.credit) * 100) !==
            Math.round(Number(build.amount) * 100)
        ) {
          add(
            product,
            'supplier_settlement_review',
            'Paid product has a Supplier Payable acquisition without a verified matching settlement pair. Possible missing payment posting requires review; it is not added to missing-cash totals.'
          );
        }
      } else if (paid && fundedAccount !== fundingAccount) {
        add(
          product,
          'funding_account_mismatch',
          'Product payment method differs from the saved build funding account. This is not a verified missing cash movement.'
        );
      } else if (
        paid &&
        linkedLines.some(
          (line) =>
            line.sourceLineKey === 'SUPPLIER_SETTLEMENT:credit' &&
            normalizeAccountForReporting(String(line.account)).toLowerCase() ===
              'cash'
        )
      ) {
        add(
          product,
          'possible_duplicate_cash_posting',
          'Cash-funded build and a separate product cash settlement both exist. Check for duplicate outflow; do not deduct the purchase again.'
        );
      }
      continue;
    }
    if (
      relatedBuilds.length ||
      linkedLines.length ||
      builds.rows.some(
        (row) =>
          String(product.shipmentCode ?? '').trim() &&
          String(row.shipmentCode).toLowerCase() ===
            String(product.shipmentCode).toLowerCase() &&
          !String(row.idempotencyKey ?? '').startsWith('PRODUCT_TRANSIT_BUILD:')
      )
    ) {
      add(
        product,
        'alternate_source_review',
        'Related product journal/component or shipment-level source exists. Product coverage is unresolved; description matching alone cannot establish missing funding.'
      );
      continue;
    }
    if (!paid) {
      continue;
    }
    if (!fundingAccount) {
      add(
        product,
        'unknown_funding_review',
        'Paid flag has no supported funding method; cash impact cannot be determined.'
      );
      continue;
    }
    if (fundingAccount === 'Credit Card Payable') {
      add(
        product,
        'card_funded_unbuilt',
        'Paid by card without a linked build-up. This is a potential liability/inventory posting gap, not an immediate cash outflow.'
      );
      continue;
    }
    const matchingManual = journals.rows.some(
      (line) =>
        line.sourceType !== 'PRODUCT' &&
        ((Math.abs(Number(line.credit) - amount) <= 0.01 &&
          normalizeAccountForReporting(String(line.account)).toLowerCase() ===
            'cash') ||
          (Math.abs(Number(line.debit) - amount) <= 0.01 &&
            line.account === 'Inventory in Transit'))
    );
    const possibleOpening = transitOpenings.rows.some(
      (entry) =>
        new Date(String(entry.date)) >= postingDate &&
        Number(entry.debit ?? 0) - Number(entry.credit ?? 0) > 0
    );
    if (matchingManual || possibleOpening) {
      add(
        product,
        'manual_or_opening_review',
        'A same-amount manual cash/transit line or dated standalone transit opening may cover this purchase; no missing-cash total is asserted for it.'
      );
      continue;
    }
    if (unresolvedCoverage) {
      add(
        product,
        'coverage_incomplete',
        'One or more required source scans failed or reached a cap; absence of a posting is not established.'
      );
      continue;
    }
    cashCandidates[fundingAccount] = Number(
      ((cashCandidates[fundingAccount] ?? 0) + amount).toFixed(2)
    );
    add(
      product,
      'possible_unposted_paid_purchase',
      'Post-cutover Paid cash/bank/GCash purchase has no active product Grand Total build or linked product journal in checked sources. Conditional outflow only: verify payment and any alternate accounting entry.'
    );
  }
  const categories: Record<string, { count: number; amount: number }> = {};
  for (const finding of findings) {
    const total = categories[finding.category] ?? { count: 0, amount: 0 };
    total.count += 1;
    total.amount = Number((total.amount + finding.amount).toFixed(2));
    categories[finding.category] = total;
  }
  return {
    status: unresolvedCoverage ? 'partial' : 'checked',
    coverage,
    categories,
    totalFindings: findings.length,
    findings: findings
      .filter((entry) => entry.category === 'possible_unposted_paid_purchase')
      .concat(
        findings.filter(
          (entry) => entry.category !== 'possible_unposted_paid_purchase'
        )
      )
      .slice(0, 50),
    hasMoreFindings: findings.length > 50,
    possibleUnpostedCashOutflows: Number(
      Object.values(cashCandidates)
        .reduce((sum, amount) => sum + amount, 0)
        .toFixed(2)
    ),
    possibleUnpostedOutflowsByAccount: cashCandidates,
    notVerified: [
      'Actual bank/GCash statements or physical cash count',
      'Whether Paid flags represent money actually paid',
      'Unlinked manual entries with different amounts or combined purchases',
      'Deleted products and shipment transfer/reclassification completeness',
      'Operational logistics bills versus journal postings',
      'Full supplier-credit balances and lifecycle amounts',
    ],
    warning:
      'Posting candidates are not confirmed missing money or permission to post entries. Book cash is not adjusted automatically. Checks are bounded and non-atomic; concurrent changes or unsupported alternate postings may require review.',
  };
}

export async function readPostedTransitCash(cutover: Date, asOf: Date) {
  if (!prisma.clothingInventoryTransitBuildEntry?.findMany) {
    return {
      status: 'not_checked' as const,
      reason: 'Transit Build-Up source is unavailable.',
      cashImpact: 0,
      physicalCashImpact: 0,
    };
  }
  try {
    const rows = await prisma.clothingInventoryTransitBuildEntry.findMany({
      where: { deletedAt: null, postingDate: { gte: cutover, lte: asOf } },
      orderBy: { postingDate: 'asc' },
    });
    let cashImpact = 0;
    let physicalCashImpact = 0;
    for (const row of rows) {
      const amount = Number(row.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        continue;
      }
      for (const [account, signedAmount] of [
        [row.debitAccount, amount],
        [row.creditAccount, -amount],
      ] as const) {
        if (normalizeAccountForReporting(account).toLowerCase() === 'cash') {
          cashImpact += signedAmount;
        }
        if (account.trim().toLowerCase() === 'cash') {
          physicalCashImpact += signedAmount;
        }
      }
    }
    return {
      status: 'checked' as const,
      reason: 'Active dated Transit Build-Up debit/credit sources inspected.',
      cashImpact: Number(cashImpact.toFixed(2)),
      physicalCashImpact: Number(physicalCashImpact.toFixed(2)),
    };
  } catch {
    return {
      status: 'not_checked' as const,
      reason:
        'Transit Build-Up sources could not be read; balance coverage is incomplete.',
      cashImpact: 0,
      physicalCashImpact: 0,
    };
  }
}

export async function readPostedReclassificationCash(
  cutover: Date,
  asOf: Date
) {
  if (!prisma.clothingInventoryReclassEntry?.findMany) {
    return {
      status: 'not_checked' as const,
      cashImpact: 0,
      physicalCashImpact: 0,
    };
  }
  try {
    const rows = await prisma.clothingInventoryReclassEntry.findMany({
      where: { deletedAt: null, postingDate: { gte: cutover, lte: asOf } },
      orderBy: { postingDate: 'asc' },
    });
    let cashImpact = 0;
    let physicalCashImpact = 0;
    for (const row of rows) {
      const amount = Number(row.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        continue;
      }
      for (const [account, signedAmount] of [
        [row.toAccount, amount],
        [row.fromAccount, -amount],
      ] as const) {
        if (normalizeAccountForReporting(account).toLowerCase() === 'cash') {
          cashImpact += signedAmount;
        }
        if (account.trim().toLowerCase() === 'cash') {
          physicalCashImpact += signedAmount;
        }
      }
    }
    return {
      status: 'checked' as const,
      cashImpact: Number(cashImpact.toFixed(2)),
      physicalCashImpact: Number(physicalCashImpact.toFixed(2)),
    };
  } catch {
    return {
      status: 'not_checked' as const,
      cashImpact: 0,
      physicalCashImpact: 0,
    };
  }
}
