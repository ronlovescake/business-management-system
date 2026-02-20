import { ApiError } from '@/lib/api/client';
import { PAID_STATUSES } from '@/lib/accounting/constants';
import { normalizeOrderStatus } from '@/lib/transactions/order-status';
import { TransactionService } from '../services/TransactionService';
import type { TransactionData } from '../types/transaction.types';

type MissingReferenceGroups = {
  customers?: string[];
  products?: string[];
  shipments?: string[];
};

function parseRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function stringifyRecord(value: Record<string, unknown>): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function buildMissingReferencesText(
  missing?: MissingReferenceGroups
): string[] {
  if (!missing) {
    return [];
  }

  const parts: string[] = [];
  if (missing.customers?.length) {
    parts.push(`customers: ${missing.customers.join(', ')}`);
  }
  if (missing.products?.length) {
    parts.push(`products: ${missing.products.join(', ')}`);
  }
  if (missing.shipments?.length) {
    parts.push(`shipments: ${missing.shipments.join(', ')}`);
  }

  return parts;
}

export function getCreateDraftTransactionErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    const apiPayload =
      typeof error.data === 'object' && error.data
        ? (error.data as Record<string, unknown>)
        : undefined;

    const parsedDetails = parseRecord(apiPayload?.details);
    const parsedMeta = parseRecord(apiPayload?.meta);
    const missingSource = parsedMeta ?? parsedDetails;
    const missing =
      missingSource && 'missing' in missingSource
        ? (missingSource.missing as MissingReferenceGroups)
        : undefined;

    const missingPieces = buildMissingReferencesText(missing);
    const serverMessage =
      typeof apiPayload?.error === 'string'
        ? apiPayload.error
        : 'Reference conflict – please verify customer/product/shipment exists.';

    if (missingPieces.length > 0) {
      return `Missing references – ${missingPieces.join('; ')}`;
    }

    if (parsedMeta || parsedDetails) {
      return serverMessage;
    }

    if (serverMessage) {
      return serverMessage;
    }

    const payloadString = apiPayload ? stringifyRecord(apiPayload) : undefined;
    if (payloadString) {
      return `Conflict – ${payloadString}`;
    }

    return 'Reference conflict – please verify customer/product/shipment exists.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Could not save the new transaction';
}

export function describeTransaction(transaction: TransactionData): string {
  const idLabel = transaction.id ? `#${transaction.id}` : 'unsaved row';
  const customer =
    transaction.Customers && transaction.Customers.trim() !== ''
      ? transaction.Customers.trim()
      : 'No customer';
  const product =
    transaction['Product Code'] && transaction['Product Code'].trim() !== ''
      ? transaction['Product Code'].trim()
      : 'No product';
  return `${idLabel} • Customer: ${customer} • Product: ${product}`;
}

export function truncateText(value: string, max = 160): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

export function formatNumberValue(value: number): string {
  return TransactionService.formatNumber(value ?? 0);
}

export function formatCurrencyValue(value: number): string {
  return TransactionService.formatCurrency(value ?? 0);
}

export function isPaidOrderStatus(value: string | null | undefined): boolean {
  const normalized = normalizeOrderStatus(value);
  return PAID_STATUSES.some(
    (status) => normalizeOrderStatus(status) === normalized
  );
}

export function buildDraftCreatePayload(draft: TransactionData) {
  return {
    'Order Date': draft['Order Date'] || '',
    Customers: draft.Customers || '',
    'Product Code': draft['Product Code'] || '',
    Quantity: draft.Quantity ?? 0,
    'Unit Price': draft['Unit Price'] ?? 0,
    Discount: draft.Discount ?? 0,
    Adjustment: draft.Adjustment ?? 0,
    'Line Total': draft['Line Total'] ?? 0,
    'Order Status': draft['Order Status'] ?? '',
    Notes: draft.Notes || '',
    'Invoice Date': draft['Invoice Date'] || '',
    'Packed Date': draft['Packed Date'] || '',
    'Shipment Code': draft['Shipment Code'] || '',
  };
}

export function buildOptimisticTransaction(
  payload: ReturnType<typeof buildDraftCreatePayload>,
  optimisticId: number
): TransactionData {
  return {
    id: optimisticId,
    ...payload,
  } as TransactionData;
}

export function buildBatchedTransactions(
  transactions: TransactionData[],
  updates: Map<number, Partial<TransactionData>>
): TransactionData[] {
  const batchedUpdates: TransactionData[] = [];

  updates.forEach((data, id) => {
    const baseline = transactions.find((transaction) => transaction.id === id);
    if (!baseline) {
      return;
    }

    batchedUpdates.push({
      ...baseline,
      ...data,
      Quantity: data.Quantity ?? baseline.Quantity ?? 0,
      'Unit Price': data['Unit Price'] ?? baseline['Unit Price'] ?? 0,
      Discount: data.Discount ?? baseline.Discount ?? 0,
      Adjustment: data.Adjustment ?? baseline.Adjustment ?? 0,
      'Line Total': data['Line Total'] ?? baseline['Line Total'] ?? 0,
    });
  });

  return batchedUpdates;
}
