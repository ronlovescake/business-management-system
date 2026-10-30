import { prisma } from '@/lib/db';
import { DueDateService } from '@/modules/clothing/operations/due-dates/services/DueDateService';
import { dayjs } from '@/utils/date';

export type ClothingDueStatus = 'overdue' | 'upcoming' | 'all';

export function getDirectClothingDueMode(
  question: string
): ClothingDueStatus | null {
  const normalized = question
    .toLowerCase()
    .trim()
    .replace(/[?.!]+$/g, '');
  if (
    normalized === 'list customers with past due dates' ||
    normalized === 'list overdue clothing customers'
  ) {
    return 'overdue';
  }
  if (
    normalized === 'list customers with due dates coming' ||
    normalized === 'list upcoming clothing due dates'
  ) {
    return 'upcoming';
  }
  return null;
}

export async function getClothingDueInvoices(
  mode: ClothingDueStatus,
  take: number,
  now: Date
) {
  const items: Array<{
    transactionId: number;
    customer: string;
    productCode: string;
    quantity: number;
    unitPrice: number;
    invoiceDate: string;
    dueAt: string;
    dueDate: string;
    orderStatus: string;
    remainingBalance: number;
    outstandingBalance: number;
    isOverdue: boolean;
    dueInHours: number;
    sourceLink: string;
  }> = [];
  let scannedRows = 0;
  let cursor: number | undefined;
  let scanLimitReached = false;
  while (scannedRows < 5000) {
    const rows = await prisma.transaction.findMany({
      where: {
        deletedAt: null,
        orderStatus: 'Prepared',
        lineTotal: { gt: 0 },
        invoiceDate: { not: null },
      },
      select: {
        id: true,
        customers: true,
        productCode: true,
        orderStatus: true,
        lineTotal: true,
        invoiceDate: true,
        quantity: true,
        unitPrice: true,
      },
      orderBy: { id: 'asc' },
      take: 500,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });
    scannedRows += rows.length;
    for (const row of rows) {
      if (
        row.orderStatus !== 'Prepared' ||
        !row.invoiceDate ||
        Number(row.lineTotal) <= 0
      ) {
        continue;
      }
      const dueAt = DueDateService.calculateDueDate(row.invoiceDate);
      if (!dueAt) {
        continue;
      }
      const hours = (new Date(dueAt).getTime() - now.getTime()) / 3600000;
      const isOverdue = hours < 0;
      if (
        (mode === 'overdue' && !isOverdue) ||
        (mode === 'upcoming' && isOverdue)
      ) {
        continue;
      }
      const balance = Number(row.lineTotal);
      items.push({
        transactionId: row.id,
        customer: row.customers ?? 'Unknown',
        productCode: row.productCode ?? 'Not recorded',
        quantity: Number(row.quantity ?? 0),
        unitPrice: Number(row.unitPrice ?? 0),
        invoiceDate: row.invoiceDate,
        dueAt,
        dueDate: dayjs(dueAt).tz('Asia/Manila').format('YYYY-MM-DD'),
        orderStatus: 'Prepared',
        remainingBalance: balance,
        outstandingBalance: balance,
        isOverdue,
        dueInHours: hours < 0 ? Math.floor(hours) : Math.ceil(hours),
        sourceLink: '/clothing/operations/due-dates',
      });
    }
    if (rows.length < 500) {
      break;
    }
    cursor = rows[rows.length - 1].id;
    scanLimitReached = scannedRows >= 5000;
  }
  items.sort(
    (left, right) =>
      left.dueAt.localeCompare(right.dueAt) ||
      left.transactionId - right.transactionId
  );
  return {
    businessUnit: 'clothing',
    dueStatus: mode,
    count: Math.min(take, items.length),
    totalCount: items.length,
    hasMore: items.length > take,
    scanLimitReached,
    scannedRows,
    overdueCount: items.filter((item) => item.isOverdue).length,
    items: items.slice(0, take),
    policy:
      'Unpaid Prepared invoices only: third calendar day after invoice, end of day Asia/Manila. Trusted-customer Accounts Receivable has no automatic deadline; follow-up is at owner discretion.',
  };
}

export type ClothingDueInvoicesResult = Awaited<
  ReturnType<typeof getClothingDueInvoices>
>;

export function formatClothingDueInvoices(
  result: ClothingDueInvoicesResult
): string {
  const cell = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\|/g, '&#124;')
      .replace(/[\r\n]+/g, ' ')
      .replace(/([\\`*_\[\]])/g, '\\$1');
  const rows = result.items.map(
    (item) =>
      `| ${cell(item.customer)} | ${cell(item.productCode)} | ${item.quantity} | PHP ${item.remainingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })} | ${dayjs(item.dueAt).tz('Asia/Manila').subtract(3, 'day').format('YYYY-MM-DD')} | ${item.dueDate} | ${Math.abs(item.dueInHours)} hours ${item.isOverdue ? 'overdue' : 'remaining'} |`
  );
  return [
    `### Clothing - ${result.dueStatus === 'upcoming' ? 'Upcoming' : 'Overdue'} Prepared Invoices`,
    `Found ${result.totalCount} matching unpaid Prepared invoice records; showing ${result.items.length}.`,
    result.scanLimitReached
      ? '**Partial search:** the scan limit was reached; do not treat this list as exhaustive.'
      : '',
    result.hasMore
      ? 'Additional matching rows are available on the Due Dates board.'
      : '',
    rows.length
      ? [
          '| Customer | Product | Qty | Balance | Invoice Date | Due Date (Manila) | Due In |',
          '| --- | --- | ---: | ---: | --- | --- | --- |',
          ...rows,
        ].join('\n')
      : 'No matching unpaid Prepared invoices were found in the scanned records.',
    'Trusted-customer Accounts Receivable is excluded: it has no automatic deadline; the owner decides when to follow up.',
    '[View Clothing Due Dates](/clothing/operations/due-dates).',
  ]
    .filter(Boolean)
    .join('\n\n');
}
