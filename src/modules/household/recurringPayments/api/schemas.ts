import { z } from 'zod';

export const HouseholdRecurringPaymentCreateSchema = z.object({
  name: z.string().trim().min(1),
  amount: z.number().positive(),
  category: z.string().trim().min(1),
  notes: z.string().trim().optional().nullable(),
  startDate: z.date(),
  monthsCount: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
  deductOnGenerate: z.boolean().optional(),
  accountId: z.string().trim().optional().nullable(),
});

export type HouseholdRecurringPaymentCreateInput = z.infer<
  typeof HouseholdRecurringPaymentCreateSchema
>;

export const HouseholdRecurringPaymentUpdateSchema =
  HouseholdRecurringPaymentCreateSchema.partial().extend({
    id: z.string().trim().min(1),
  });

export type HouseholdRecurringPaymentUpdateInput = z.infer<
  typeof HouseholdRecurringPaymentUpdateSchema
>;

export const HouseholdRecurringPaymentGenerateSchema = z
  .object({
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'month must be in YYYY-MM format')
      .optional(),
  })
  .optional();

export type HouseholdRecurringPaymentGenerateInput = z.infer<
  typeof HouseholdRecurringPaymentGenerateSchema
>;
