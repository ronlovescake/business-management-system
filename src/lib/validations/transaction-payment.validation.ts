import { z } from 'zod';

export const transactionPaymentCreateSchema = z.object({
  transactionId: z.number().int().positive(),
  paymentDate: z.string().min(1).max(50),
  amount: z.number().finite().positive(),
  method: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  isReservation: z.boolean().optional(),
  originalDepositRate: z.union([z.literal(10), z.literal(20)]).optional(),
});

export const transactionPaymentBulkCreateSchema = z.object({
  payments: z.array(transactionPaymentCreateSchema).min(1).max(500),
});

export type TransactionPaymentCreateInput = z.infer<
  typeof transactionPaymentCreateSchema
>;

export type TransactionPaymentBulkCreateInput = z.infer<
  typeof transactionPaymentBulkCreateSchema
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
