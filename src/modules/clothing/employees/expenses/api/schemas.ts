/**
 * Expense Validation Schemas
 *
 * Zod schemas for expense data validation
 */

import { z } from 'zod';
import { expenseCategoryOptions } from '../utils';

const BaseSourceTypeSchema = z.string().trim().max(50);

const SourceTypeCreateSchema = BaseSourceTypeSchema.optional()
  .transform((val) => (val ? val.toUpperCase() : 'MANUAL'))
  .default('MANUAL');

const SourceTypeFilterSchema = BaseSourceTypeSchema.optional().transform(
  (val) => (val ? val.toUpperCase() : undefined)
);

const OptionalSourceIdSchema = z
  .string()
  .trim()
  .max(100)
  .transform((val) => (val === '' ? null : val))
  .nullable()
  .optional();

/**
 * Expense status enum
 */
export const ExpenseStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'paid',
]);
export type ExpenseStatus = z.infer<typeof ExpenseStatusSchema>;

/**
 * Expense category enum
 */
export const ExpenseCategorySchema = z.enum(expenseCategoryOptions);
export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;

/**
 * Schema for creating a new expense (API input with Date)
 */
export const ExpenseCreateSchema = z.object({
  date: z.coerce.date(),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required').max(500),
  category: ExpenseCategorySchema,
  notes: z.string().max(1000).optional(),
  receipt: z.string().url().nullable().optional(),
  status: ExpenseStatusSchema.default('pending'),
  employeeName: z.string().optional().nullable(),
  sourceType: SourceTypeCreateSchema,
  sourceId: OptionalSourceIdSchema,
  sourceLineKey: OptionalSourceIdSchema,
  systemGenerated: z.boolean().default(false),
});

export type ExpenseCreateInput = z.infer<typeof ExpenseCreateSchema>;

/**
 * Database input type (date as string in YYYY-MM-DD format)
 */
export type ExpenseCreateDbInput = Omit<ExpenseCreateInput, 'date'> & {
  date: string;
};

/**
 * Schema for updating an expense
 */
export const ExpenseUpdateSchema = ExpenseCreateSchema.partial().extend({
  id: z.number().int().positive(),
});

export type ExpenseUpdateInput = z.infer<typeof ExpenseUpdateSchema>;

/**
 * Schema for batch create (CSV import)
 */
export const ExpenseBatchCreateSchema = z
  .array(ExpenseCreateSchema)
  .max(10000, 'Maximum 10,000 expenses per batch');

/**
 * Schema for batch update
 */
export const ExpenseBatchUpdateSchema = z
  .array(ExpenseUpdateSchema)
  .max(10000, 'Maximum 10,000 expenses per batch');

/**
 * Query filters schema
 */
export const ExpenseQuerySchema = z.object({
  category: ExpenseCategorySchema.optional(),
  status: ExpenseStatusSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  employeeName: z.string().optional(),
  minAmount: z.number().nonnegative().optional(),
  maxAmount: z.number().nonnegative().optional(),
  sourceType: SourceTypeFilterSchema,
});

export type ExpenseQuery = z.infer<typeof ExpenseQuerySchema>;
