import type { TransactionData } from '../types/transaction.types';

export type PaymentDraft = {
  transactionId: number;
  amount: number;
};

export type BulkPaymentsRequest = {
  payments: Array<{
    transactionId: number;
    paymentDate: string;
    amount: number;
    method?: string | null;
    notes?: string | null;
    isReservation?: boolean;
  }>;
};

type BuildBulkPaymentsPayloadParams = {
  payloadDrafts: PaymentDraft[];
  paymentDate: Date;
  method: string | null;
  notes: string;
  isReservation: boolean;
};

export const toPaymentDrafts = (
  amountByTransactionId: Record<number, number>
): PaymentDraft[] => {
  const drafts: PaymentDraft[] = [];

  for (const [key, rawValue] of Object.entries(amountByTransactionId)) {
    const transactionId = Number(key);
    if (!Number.isFinite(transactionId) || transactionId <= 0) {
      continue;
    }

    const amount = Number(rawValue);
    if (!Number.isFinite(amount) || amount <= 0) {
      continue;
    }

    drafts.push({ transactionId, amount });
  }

  return drafts;
};

export const getTransactionBaseTotal = (
  transaction: TransactionData
): number => {
  const paidSoFar = Number(transaction.Adjustment) || 0;
  const quantity = Number(transaction.Quantity) || 0;
  const unitPrice = Number(transaction['Unit Price']) || 0;
  const lineTotalRaw = Number(transaction['Line Total']);

  return Number.isFinite(lineTotalRaw)
    ? lineTotalRaw
    : quantity * unitPrice - paidSoFar;
};

export const buildBulkPaymentsPayload = ({
  payloadDrafts,
  paymentDate,
  method,
  notes,
  isReservation,
}: BuildBulkPaymentsPayloadParams): BulkPaymentsRequest => {
  const trimmedNotes = notes.trim();

  return {
    payments: payloadDrafts.map((draft) => ({
      transactionId: draft.transactionId,
      amount: draft.amount,
      paymentDate: paymentDate.toISOString().slice(0, 10),
      method,
      notes: trimmedNotes ? trimmedNotes : null,
      isReservation,
    })),
  };
};
