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
