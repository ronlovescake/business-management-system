import { prisma } from '@/lib/db';
import { PAID_STATUSES } from '@/lib/accounting/constants';
import { isCancelledOrderStatus } from '@/lib/transactions/order-status';
import { ensureAiAssistantTables } from '../settings';
import {
  autoResolveStaleAlertsInStore,
  getOpenClothingTransactionAlertsInStore,
  upsertMonitoringAlertInStore,
} from '../store';
import type { AiBusinessUnit, DetectedAnomalyInput } from '../types';

const EPS = 0.01;

export interface MonitoringRunSummary {
  ranAt: string;
  detectedCount: number;
  upsertedCount: number;
  autoResolvedCount: number;
  byBusinessUnit: Record<AiBusinessUnit, number>;
}

export async function collectDeterministicAnomalies(
  referencedClothingIds: number[] = [],
  evaluatedClothingIds: Set<number> = new Set<number>()
): Promise<DetectedAnomalyInput[]> {
  const anomalies: DetectedAnomalyInput[] = [];
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const paidStatuses: string[] = [...PAID_STATUSES, 'Paid'];

  // 1. Clothing Transactions: Overdue Receivables & Accounting Mismatches
  const clothingTxs = await prisma.transaction.findMany({
    where: { deletedAt: null },
    orderBy: { id: 'desc' },
    take: 300,
  });
  const loadedIds = new Set(clothingTxs.map((tx) => tx.id));
  const missingIds = Array.from(new Set(referencedClothingIds)).filter(
    (id) => !loadedIds.has(id)
  );
  for (let offset = 0; offset < missingIds.length; offset += 300) {
    const olderRows = await prisma.transaction.findMany({
      where: {
        deletedAt: null,
        id: { in: missingIds.slice(offset, offset + 300) },
      },
    });
    clothingTxs.push(...olderRows);
  }

  for (const tx of clothingTxs) {
    evaluatedClothingIds.add(tx.id);
    const qty = Number(tx.quantity ?? 0);
    const price = Number(tx.unitPrice ?? 0);
    const gross = Number((qty * price).toFixed(2));
    const adj = Number(tx.adjustment ?? 0);
    const lineTotal = Number(tx.lineTotal ?? 0);
    const expectedLine = Number((gross - adj).toFixed(2));
    const status = (tx.orderStatus || '').trim();
    const closed = isCancelledOrderStatus(status);
    const inputs = {
      quantity: qty,
      unitPrice: price,
      discount: Number(tx.discount ?? 0),
      orderStatus: status,
    };

    if (
      (closed || paidStatuses.includes(status)) &&
      Math.abs(lineTotal) > EPS
    ) {
      anomalies.push({
        dedupeKey: `clothing:${closed ? 'cancelled' : 'paid'}-nonzero-balance:${tx.id}`,
        businessUnit: 'clothing',
        category: 'ACCOUNTING_MISMATCH',
        severity: 'CRITICAL',
        title: `Clothing Order #${tx.id} marked ${status} with ₱${lineTotal.toFixed(2)} remaining balance`,
        deterministicSummary: `Customer "${tx.customers ?? 'Unknown'}" order #${tx.id} (${tx.productCode ?? 'N/A'}) has status "${status}", gross ₱${gross.toFixed(2)}, adjustment ₱${adj.toFixed(2)}, but lineTotal is ₱${lineTotal.toFixed(2)} instead of ₱0.00.`,
        sourceLink: '/clothing/operations/transactions',
        evidenceJson: {
          ...inputs,
          transactionId: tx.id,
          customer: tx.customers,
          productCode: tx.productCode,
          grossSale: gross,
          adjustment: adj,
          lineTotal,
        },
      });
    } else if (!closed && Math.abs(lineTotal - expectedLine) > EPS) {
      anomalies.push({
        dedupeKey: `clothing:line-formula-mismatch:${tx.id}`,
        businessUnit: 'clothing',
        category: 'ACCOUNTING_MISMATCH',
        severity: 'WARNING',
        title: `Clothing Order #${tx.id} line total mismatch (Δ ₱${Math.abs(lineTotal - expectedLine).toFixed(2)})`,
        deterministicSummary: `Order #${tx.id} for "${tx.customers ?? 'Unknown'}" has recorded lineTotal ₱${lineTotal.toFixed(2)}, which differs from gross (₱${gross.toFixed(2)}) minus adjustment (₱${adj.toFixed(2)}) = ₱${expectedLine.toFixed(2)}.`,
        sourceLink: '/clothing/operations/transactions',
        evidenceJson: {
          ...inputs,
          transactionId: tx.id,
          customer: tx.customers,
          grossSale: gross,
          adjustment: adj,
          lineTotal,
          expectedLineTotal: expectedLine,
        },
      });
    }

    if (
      tx.accountsReceivableDueAt &&
      tx.accountsReceivableDueAt < now &&
      !closed &&
      !paidStatuses.includes(status) &&
      lineTotal > EPS
    ) {
      const dueStr = tx.accountsReceivableDueAt.toISOString().slice(0, 10);
      anomalies.push({
        dedupeKey: `clothing:overdue-receivable:${tx.id}`,
        businessUnit: 'clothing',
        category: 'INVOICE_OVERDUE',
        severity: 'WARNING',
        title: `Overdue Clothing Receivable #${tx.id} — ${tx.customers ?? 'Unknown'} (₱${lineTotal.toFixed(2)})`,
        deterministicSummary: `Order #${tx.id} (${tx.productCode ?? 'N/A'}) for "${tx.customers ?? 'Unknown'}" was due on ${dueStr} with an unpaid balance of ₱${lineTotal.toFixed(2)}.`,
        sourceLink: '/clothing/operations/transactions',
        evidenceJson: {
          ...inputs,
          transactionId: tx.id,
          customer: tx.customers,
          dueAt: dueStr,
          unpaidBalance: lineTotal,
        },
      });
    }
  }

  // 2. General Merchandise: Overdue Receivables & Accounting Mismatches
  const gmTxs = await prisma.generalMerchandiseTransaction.findMany({
    where: { deletedAt: null },
    orderBy: { id: 'desc' },
    take: 300,
  });

  for (const tx of gmTxs) {
    const qty = Number(tx.quantity ?? 0);
    const price = Number(tx.unitPrice ?? 0);
    const gross = Number((qty * price - Number(tx.discount ?? 0)).toFixed(2));
    const adj = Number(tx.adjustment ?? 0);
    const lineTotal = Number(tx.lineTotal ?? 0);
    const expectedLine = Number((gross - adj).toFixed(2));
    const status = (tx.orderStatus || '').trim();

    if (paidStatuses.includes(status) && Math.abs(lineTotal) > EPS) {
      anomalies.push({
        dedupeKey: `gm:paid-nonzero-balance:${tx.id}`,
        businessUnit: 'general-merchandise',
        category: 'ACCOUNTING_MISMATCH',
        severity: 'CRITICAL',
        title: `GM Order #${tx.id} marked ${status} with ₱${lineTotal.toFixed(2)} remaining balance`,
        deterministicSummary: `GM Customer "${tx.customers ?? 'Unknown'}" order #${tx.id} (${tx.productCode ?? 'N/A'}) is marked "${status}" but has remaining lineTotal ₱${lineTotal.toFixed(2)}.`,
        sourceLink: '/general-merchandise/operations/transactions',
        evidenceJson: {
          transactionId: tx.id,
          customer: tx.customers,
          productCode: tx.productCode,
          orderStatus: status,
          grossSale: gross,
          adjustment: adj,
          lineTotal,
        },
      });
    } else if (Math.abs(lineTotal - expectedLine) > EPS) {
      anomalies.push({
        dedupeKey: `gm:line-formula-mismatch:${tx.id}`,
        businessUnit: 'general-merchandise',
        category: 'ACCOUNTING_MISMATCH',
        severity: 'WARNING',
        title: `GM Order #${tx.id} line total mismatch (Δ ₱${Math.abs(lineTotal - expectedLine).toFixed(2)})`,
        deterministicSummary: `GM Order #${tx.id} has recorded lineTotal ₱${lineTotal.toFixed(2)} vs expected ₱${expectedLine.toFixed(2)}.`,
        sourceLink: '/general-merchandise/operations/transactions',
        evidenceJson: {
          transactionId: tx.id,
          customer: tx.customers,
          grossSale: gross,
          adjustment: adj,
          lineTotal,
          expectedLineTotal: expectedLine,
        },
      });
    }

    if (status === 'Pending Payment' && lineTotal > EPS) {
      const dueStr = tx.orderDate || tx.createdAt.toISOString().slice(0, 10);
      anomalies.push({
        dedupeKey: `gm:overdue-receivable:${tx.id}`,
        businessUnit: 'general-merchandise',
        category: 'INVOICE_OVERDUE',
        severity: 'WARNING',
        title: `Pending GM Receivable #${tx.id} — ${tx.customers ?? 'Unknown'} (₱${lineTotal.toFixed(2)})`,
        deterministicSummary: `General Merchandise order #${tx.id} for "${tx.customers ?? 'Unknown'}" (${dueStr}) has a pending payment balance of ₱${lineTotal.toFixed(2)}.`,
        sourceLink: '/general-merchandise/operations/transactions',
        evidenceJson: {
          transactionId: tx.id,
          customer: tx.customers,
          dueAt: dueStr,
          unpaidBalance: lineTotal,
        },
      });
    }
  }

  // 3. Trucking Invoices: Overdue & Paid Allocation Discrepancies
  const truckingInvoices = await prisma.truckingInvoice.findMany({
    where: { status: { not: 'VOID' } },
    include: {
      customer: { select: { customerName: true } },
      allocations: { select: { amount: true } },
    },
    orderBy: { invoiceDate: 'desc' },
    take: 150,
  });

  for (const inv of truckingInvoices) {
    const total = Number(inv.totalAmount);
    const allocated = inv.allocations.reduce(
      (s: number, a: { amount: unknown }) => s + Number(a.amount),
      0
    );
    const diff = Number((total - allocated).toFixed(2));
    const custName = inv.customer.customerName;

    if (inv.status === 'PAID' && Math.abs(diff) > EPS) {
      anomalies.push({
        dedupeKey: `trucking:paid-invoice-mismatch:${inv.id}`,
        businessUnit: 'trucking',
        category: 'ACCOUNTING_MISMATCH',
        severity: 'CRITICAL',
        title: `Trucking Invoice ${inv.id} marked PAID with ₱${diff.toFixed(2)} allocation discrepancy`,
        deterministicSummary: `Trucking invoice ${inv.id} for "${custName}" has total ₱${total.toFixed(2)} and recorded allocations of ₱${allocated.toFixed(2)} (difference: ₱${diff.toFixed(2)}).`,
        sourceLink: '/trucking/operations/trips',
        evidenceJson: {
          invoiceId: inv.id,
          customer: custName,
          totalAmount: total,
          allocatedPayments: Number(allocated.toFixed(2)),
          discrepancy: diff,
        },
      });
    } else if (
      inv.status !== 'PAID' &&
      inv.dueDate &&
      inv.dueDate < now &&
      diff > EPS
    ) {
      const dueStr = inv.dueDate.toISOString().slice(0, 10);
      anomalies.push({
        dedupeKey: `trucking:overdue-invoice:${inv.id}`,
        businessUnit: 'trucking',
        category: 'INVOICE_OVERDUE',
        severity: 'WARNING',
        title: `Overdue Trucking Invoice — ${custName} (₱${diff.toFixed(2)} unpaid)`,
        deterministicSummary: `Trucking invoice ${inv.id} for "${custName}" was due on ${dueStr}. Total: ₱${total.toFixed(2)}, Paid: ₱${allocated.toFixed(2)}, Balance: ₱${diff.toFixed(2)}.`,
        sourceLink: '/trucking/operations/trips',
        evidenceJson: {
          invoiceId: inv.id,
          customer: custName,
          dueDate: dueStr,
          totalAmount: total,
          remainingBalance: diff,
        },
      });
    }
  }

  // 4. Recurring Payment Obligations Due Within 3 Days (Clothing & GM)
  const [clothingRecurring, gmRecurring] = await Promise.all([
    prisma.clothingRecurringPaymentTemplate.findMany({
      where: { isActive: true, nextDueDate: { lte: threeDaysFromNow } },
      take: 25,
    }),
    prisma.generalMerchandiseRecurringPaymentTemplate.findMany({
      where: { isActive: true, nextDueDate: { lte: threeDaysFromNow } },
      take: 25,
    }),
  ]);

  for (const item of clothingRecurring) {
    const dueStr = item.nextDueDate.toISOString().slice(0, 10);
    const isPastDue = item.nextDueDate < now;
    anomalies.push({
      dedupeKey: `clothing:recurring-due:${item.id}:${dueStr}`,
      businessUnit: 'clothing',
      category: 'RECURRING_PAYMENT_DUE',
      severity: isPastDue ? 'CRITICAL' : 'INFO',
      title: `${isPastDue ? 'Overdue' : 'Upcoming'} Clothing ${item.kind}: ${item.name} (₱${item.amount.toFixed(2)})`,
      deterministicSummary: `Recurring ${item.kind.toLowerCase()} "${item.name}" of ₱${item.amount.toFixed(2)} (${item.frequency}) is scheduled for ${dueStr}.`,
      sourceLink: '/clothing/accounting',
      evidenceJson: {
        templateId: item.id,
        name: item.name,
        kind: item.kind,
        amount: item.amount,
        nextDueDate: dueStr,
      },
    });
  }

  for (const item of gmRecurring) {
    const dueStr = item.nextDueDate.toISOString().slice(0, 10);
    const isPastDue = item.nextDueDate < now;
    anomalies.push({
      dedupeKey: `gm:recurring-due:${item.id}:${dueStr}`,
      businessUnit: 'general-merchandise',
      category: 'RECURRING_PAYMENT_DUE',
      severity: isPastDue ? 'CRITICAL' : 'INFO',
      title: `${isPastDue ? 'Overdue' : 'Upcoming'} GM ${item.kind}: ${item.name} (₱${item.amount.toFixed(2)})`,
      deterministicSummary: `General Merchandise recurring ${item.kind.toLowerCase()} "${item.name}" of ₱${item.amount.toFixed(2)} is scheduled for ${dueStr}.`,
      sourceLink: '/general-merchandise/accounting',
      evidenceJson: {
        templateId: item.id,
        name: item.name,
        kind: item.kind,
        amount: item.amount,
        nextDueDate: dueStr,
      },
    });
  }

  // 5. Inventory Negative Stock Anomalies (Clothing & GM)
  const [negativeClothingProducts, negativeGmProducts] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null, quantity: { lt: -EPS } },
      select: { id: true, productCode: true, product: true, quantity: true },
      take: 25,
    }),
    prisma.generalMerchandiseProduct.findMany({
      where: { deletedAt: null, quantity: { lt: -EPS } },
      select: { id: true, productCode: true, product: true, quantity: true },
      take: 25,
    }),
  ]);

  for (const prod of negativeClothingProducts) {
    const code = prod.productCode ?? `#${prod.id}`;
    anomalies.push({
      dedupeKey: `clothing:negative-stock:${prod.id}`,
      businessUnit: 'clothing',
      category: 'INVENTORY_DRIFT',
      severity: 'WARNING',
      title: `Negative Clothing Stock: ${code} (${prod.quantity} units)`,
      deterministicSummary: `Clothing product "${prod.product ?? code}" (${code}) has negative recorded quantity of ${prod.quantity}.`,
      sourceLink: '/clothing/operations/inventory',
      evidenceJson: {
        productId: prod.id,
        code,
        name: prod.product,
        inStock: prod.quantity,
      },
    });
  }

  for (const prod of negativeGmProducts) {
    const code = prod.productCode ?? `#${prod.id}`;
    anomalies.push({
      dedupeKey: `gm:negative-stock:${prod.id}`,
      businessUnit: 'general-merchandise',
      category: 'INVENTORY_DRIFT',
      severity: 'WARNING',
      title: `Negative GM Stock: ${code} (${prod.quantity} units)`,
      deterministicSummary: `General Merchandise product "${prod.product ?? code}" (${code}) has negative recorded quantity of ${prod.quantity}.`,
      sourceLink: '/general-merchandise/operations/inventory',
      evidenceJson: {
        productId: prod.id,
        code,
        name: prod.product,
        inStock: prod.quantity,
      },
    });
  }

  return anomalies;
}

export async function runDeterministicBusinessMonitor(): Promise<MonitoringRunSummary> {
  await ensureAiAssistantTables();
  const now = new Date();
  const snapshot = await getOpenClothingTransactionAlertsInStore();
  const candidates = snapshot.flatMap((alert) => {
    const match =
      /^clothing:(?:paid-nonzero-balance|cancelled-nonzero-balance|line-formula-mismatch|overdue-receivable):(\d+)$/.exec(
        alert.dedupeKey
      );
    const evidence = alert.evidenceJson;
    if (
      !match ||
      !evidence ||
      typeof evidence !== 'object' ||
      !('transactionId' in evidence)
    ) {
      return [];
    }
    const transactionId = Number(match[1]);
    if (
      !Number.isSafeInteger(transactionId) ||
      transactionId <= 0 ||
      evidence.transactionId !== transactionId
    ) {
      return [];
    }
    return [{ alert, transactionId }];
  });
  const evaluatedIds = new Set<number>();
  const detected = await collectDeterministicAnomalies(
    candidates.map((candidate) => candidate.transactionId),
    evaluatedIds
  );
  const activeDedupeKeys = new Set(detected.map((d) => d.dedupeKey));

  const byBusinessUnit: Record<AiBusinessUnit, number> = {
    clothing: 0,
    trucking: 0,
    'general-merchandise': 0,
  };

  let upsertedCount = 0;
  for (const item of detected) {
    byBusinessUnit[item.businessUnit] += 1;
    await upsertMonitoringAlertInStore({
      dedupeKey: item.dedupeKey,
      businessUnit: item.businessUnit,
      category: item.category,
      severity: item.severity,
      title: item.title,
      deterministicSummary: item.deterministicSummary,
      sourceLink: item.sourceLink,
      evidenceJson: item.evidenceJson,
      now,
    });
    upsertedCount += 1;
  }

  const autoResolvedCount = await autoResolveStaleAlertsInStore(
    candidates
      .filter(
        ({ alert, transactionId }) =>
          evaluatedIds.has(transactionId) &&
          !activeDedupeKeys.has(alert.dedupeKey)
      )
      .map(({ alert }) => alert),
    now
  );

  return {
    ranAt: now.toISOString(),
    detectedCount: detected.length,
    upsertedCount,
    autoResolvedCount,
    byBusinessUnit,
  };
}

let lastLocalMonitorRunMs = 0;

export async function runDeterministicBusinessMonitorIfDue(
  minIntervalMs = 15 * 60 * 1000
): Promise<MonitoringRunSummary | null> {
  const nowMs = Date.now();
  if (nowMs - lastLocalMonitorRunMs < minIntervalMs) {
    return null;
  }
  lastLocalMonitorRunMs = nowMs;
  try {
    return await runDeterministicBusinessMonitor();
  } catch (err) {
    lastLocalMonitorRunMs = 0;
    throw err;
  }
}
