import { z } from 'zod';
import { householdExpenseCategoryOptions } from '../utils';

const SourceTypeSchema = z
  .string()
  .trim()
  .max(50)
  .optional()
  .transform((val) => (val ? val.toUpperCase() : 'MANUAL'))
  .default('MANUAL');

const OptionalId = z
  .string()
  .trim()
  .max(100)
  .transform((val) => (val === '' ? null : val))
  .nullable()
  .optional();

export const HouseholdExpenseStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'paid',
]);
export type HouseholdExpenseStatus = z.infer<
  typeof HouseholdExpenseStatusSchema
>;

export const HouseholdExpenseCategorySchema = z.enum(
  householdExpenseCategoryOptions
);
export type HouseholdExpenseCategory = z.infer<
  typeof HouseholdExpenseCategorySchema
>;

export const HouseholdExpenseCreateSchema = z.object({
  date: z.coerce.date(),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required').max(500),
  category: HouseholdExpenseCategorySchema,
  // UI may send null; accept nullable and trim empty to null for consistency
  notes: z
    .string()
    .trim()
    .max(1000)
    .transform((val) => (val === '' ? null : val))
    .nullable()
    .optional(),
  // Allow either a URL or a stored filename/path (UI currently passes a filename)
  receipt: z.string().trim().max(500).nullable().optional(),
  status: HouseholdExpenseStatusSchema.default('pending'),
  loggedBy: z.string().optional().nullable(),
  paymentMethod: z.string().trim().max(50).optional(),
  paymentCardId: z.string().trim().max(100).optional(),
  accountId: z
    .string()
    .trim()
    .max(255)
    .transform((val) => (val === '' ? null : val))
    .nullable()
    .optional(),
  sourceType: SourceTypeSchema,
  sourceId: OptionalId,
  sourceLineKey: OptionalId,
  systemGenerated: z.boolean().default(false),
});

export type HouseholdExpenseCreateInput = z.infer<
  typeof HouseholdExpenseCreateSchema
>;

export type HouseholdExpenseCreateDbInput = Omit<
  HouseholdExpenseCreateInput,
  'date'
> & {
  date: string;
};

export const HouseholdExpenseUpdateSchema =
  HouseholdExpenseCreateSchema.partial().extend({
    id: z.number().int().positive(),
  });

export type HouseholdExpenseUpdateInput = z.infer<
  typeof HouseholdExpenseUpdateSchema
>;

export const HouseholdExpenseBatchCreateSchema = z
  .array(HouseholdExpenseCreateSchema)
  .max(10000, 'Maximum 10,000 expenses per batch');

export const HouseholdExpenseBatchUpdateSchema = z
  .array(HouseholdExpenseUpdateSchema)
  .max(10000, 'Maximum 10,000 expenses per batch');

export const HouseholdExpenseQuerySchema = z.object({
  category: HouseholdExpenseCategorySchema.optional(),
  status: HouseholdExpenseStatusSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  loggedBy: z.string().optional(),
  minAmount: z.number().nonnegative().optional(),
  maxAmount: z.number().nonnegative().optional(),
  sourceType: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((val) => (val ? val.toUpperCase() : undefined)),
});

export type HouseholdExpenseQuery = z.infer<typeof HouseholdExpenseQuerySchema>;
