import { z } from 'zod';

export const HouseholdIncomeTypeSchema = z.enum([
  'BUSINESS_DRAW',
  'SALARY',
  'FREELANCE',
  'GIFT',
  'REFUND',
  'OTHER',
]);
export type HouseholdIncomeType = z.infer<typeof HouseholdIncomeTypeSchema>;

const OptionalText = z
  .string()
  .trim()
  .transform((val) => (val === '' ? null : val))
  .nullable()
  .optional();

export const HouseholdIncomeCreateSchema = z.object({
  date: z.coerce.date(),
  type: HouseholdIncomeTypeSchema,
  amount: z.number().positive('Amount must be positive'),
  account: OptionalText,
  notes: OptionalText,
});

export type HouseholdIncomeCreateInput = z.infer<
  typeof HouseholdIncomeCreateSchema
>;

export type HouseholdIncomeCreateDbInput = Omit<
  HouseholdIncomeCreateInput,
  'date'
> & {
  date: string;
};

export const HouseholdIncomeUpdateSchema =
  HouseholdIncomeCreateSchema.partial().extend({
    id: z.string().min(1),
  });

export type HouseholdIncomeUpdateInput = z.infer<
  typeof HouseholdIncomeUpdateSchema
>;

export const HouseholdIncomeBatchCreateSchema = z
  .array(HouseholdIncomeCreateSchema)
  .max(10000, 'Maximum 10,000 income records per batch');

export const HouseholdIncomeQuerySchema = z.object({
  type: HouseholdIncomeTypeSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  account: z.string().trim().max(255).optional(),
  search: z.string().trim().max(255).optional(),
});

export type HouseholdIncomeQuery = z.infer<typeof HouseholdIncomeQuerySchema>;
