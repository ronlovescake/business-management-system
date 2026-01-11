import { z } from 'zod';

export const HouseholdBudgetPeriodSchema = z.enum(['monthly', 'annual']);

const monthSchema = z.number().int().min(1).max(12);
const yearSchema = z.number().int().min(2000).max(3000);

export const HouseholdBudgetBaseSchema = z.object({
  category: z.string().trim().min(1),
  period: HouseholdBudgetPeriodSchema,
  plannedAmount: z.number().min(0),
  actualAmount: z.number().min(0).optional().default(0),
  month: monthSchema.optional().nullable(),
  year: yearSchema.optional().nullable(),
  accountId: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const HouseholdBudgetCreateSchema = HouseholdBudgetBaseSchema.refine(
  (data) => {
    if (data.period === 'monthly') {
      return data.month !== undefined && data.month !== null;
    }
    return true;
  },
  {
    message: 'month is required for monthly budgets',
    path: ['month'],
  }
).refine(
  (data) => {
    if (data.period === 'monthly') {
      return data.year !== undefined && data.year !== null;
    }
    return true;
  },
  {
    message: 'year is required for monthly budgets',
    path: ['year'],
  }
);

export type HouseholdBudgetCreateInput = z.infer<
  typeof HouseholdBudgetCreateSchema
>;

export const HouseholdBudgetUpdateSchema =
  HouseholdBudgetBaseSchema.partial().extend({
    id: z.string().trim().min(1),
  });

export type HouseholdBudgetUpdateInput = z.infer<
  typeof HouseholdBudgetUpdateSchema
>;

export const HouseholdBudgetDeleteSchema = z.object({
  id: z.string().trim().min(1),
});

export type HouseholdBudgetDeleteInput = z.infer<
  typeof HouseholdBudgetDeleteSchema
>;
