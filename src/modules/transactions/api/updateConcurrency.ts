import { createHash } from 'node:crypto';
import type { Transaction } from '@prisma/client';

const revisionFields = [
  'updatedAt',
  'deletedAt',
  'orderDate',
  'customers',
  'customerId',
  'productCode',
  'quantity',
  'unitPrice',
  'discount',
  'adjustment',
  'lineTotal',
  'orderStatus',
  'notes',
  'invoiceDate',
  'packedDate',
  'shipmentCode',
] as const satisfies readonly (keyof Transaction)[];

type RevisionSource = Partial<
  Pick<Transaction, (typeof revisionFields)[number]>
>;

export function getTransactionRevision(transaction: RevisionSource): string {
  return createHash('sha256')
    .update(
      JSON.stringify(revisionFields.map((key) => transaction[key] ?? null))
    )
    .digest('hex');
}

export class TransactionConflictError extends Error {
  constructor(
    public transactionIds: number[] = [],
    public fields: string[] = []
  ) {
    super(
      'This transaction changed since it was loaded. Refresh and review the saved values before retrying.'
    );
    this.name = 'TransactionConflictError';
  }
}

export function getCreationKey(payload: unknown[]): string | undefined {
  const entry = payload[0];
  const key =
    entry && typeof entry === 'object' && 'creationKey' in entry
      ? entry.creationKey
      : undefined;
  if (key === undefined) {
    return undefined;
  }
  if (
    payload.length !== 1 ||
    typeof key !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      key
    )
  ) {
    throw new Error('Invalid single-row creation key');
  }
  return key;
}

export function assertTransactionRevision(
  existing: RevisionSource,
  revision: string | undefined,
  transactionId: number,
  fields: string[]
) {
  if (
    existing.deletedAt ||
    (revision !== undefined && getTransactionRevision(existing) !== revision)
  ) {
    throw new TransactionConflictError([transactionId], fields);
  }
}

export function isTransactionWriteConflict(error: unknown): boolean {
  return (
    error instanceof TransactionConflictError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 'P2025' || error.code === 'P2034'))
  );
}
