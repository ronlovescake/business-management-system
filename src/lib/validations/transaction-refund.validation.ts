import { z } from 'zod';

export const INVENTORY_BUCKETS = [
  'sellable',
  'damaged_hold',
  'reserved',
  'assembly_wip',
  'scrap',
  'sold',
] as const;

export type InventoryBucket = (typeof INVENTORY_BUCKETS)[number];

export const transactionRefundCreateSchema = z.object({
  transactionId: z.number().int().positive(),
  refundDate: z.string().min(1).max(50),
  amount: z.number().min(0),
  reason: z.string().max(255).nullable().optional(),
  returnedQuantity: z.number().min(0).nullable().optional(),
  restockBucket: z.enum(INVENTORY_BUCKETS).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type TransactionRefundCreateInput = z.infer<
  typeof transactionRefundCreateSchema
>;

type RefundLimitRow = {
  amount: number | null;
  returnedQuantity: number | null;
};

export function computeTransactionRefundLimit(params: {
  lineTotal: number | null;
  adjustment: number | null;
  quantity: number | null;
  unitPrice: number | null;
  discount: number | null;
}): number {
  const lineTotal = params.lineTotal;
  const total =
    lineTotal !== null && Number.isFinite(lineTotal)
      ? lineTotal + (params.adjustment ?? 0)
      : (params.quantity ?? 0) * (params.unitPrice ?? 0) -
        (params.discount ?? 0);

  return Number.isFinite(total) ? Math.max(total, 0) : 0;
}

export function validateCumulativeRefundLimits(params: {
  transactionAmount: number;
  transactionQuantity: number;
  existingRefunds: RefundLimitRow[];
  amount: number;
  returnedQuantity: number;
}): { field: 'amount' | 'returnedQuantity'; message: string } | null {
  const refundedAmount = params.existingRefunds.reduce(
    (total, refund) => total + (refund.amount ?? 0),
    0
  );
  if (
    Math.round((refundedAmount + params.amount) * 100) >
    Math.round(params.transactionAmount * 100)
  ) {
    return {
      field: 'amount',
      message: 'Total refunds cannot exceed the original transaction amount.',
    };
  }

  const returnedQuantity = params.existingRefunds.reduce(
    (total, refund) => total + (refund.returnedQuantity ?? 0),
    0
  );
  if (
    returnedQuantity + params.returnedQuantity >
    params.transactionQuantity + 0.000001
  ) {
    return {
      field: 'returnedQuantity',
      message: 'Total returned quantity cannot exceed the original quantity.',
    };
  }

  return null;
}

export function formatValidationErrors(
  errors: z.ZodError
): Record<string, string> {
  const formattedErrors: Record<string, string> = {};

  errors.errors.forEach((error) => {
    const path = error.path.join('.');
    formattedErrors[path] = error.message;
  });

  return formattedErrors;
}
