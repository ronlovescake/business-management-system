import { z } from 'zod';

export const transactionPaymentCreateSchema = z.object({
  transactionId: z.number().int().positive(),
  paymentDate: z.string().min(1).max(50),
  amount: z.number().min(0),
  method: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  // When true, this payment is a reservation fee / customer deposit.
  // Accounting can treat it differently from sales revenue.
  isReservation: z.boolean().optional(),
});

export const transactionPaymentBulkCreateSchema = z.object({
  payments: z
    .array(
      transactionPaymentCreateSchema.extend({
        amount: z.number().positive(),
      })
    )
    .min(1)
    .max(500),
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
