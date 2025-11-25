/**
 * Thirteenth Month Pay Validation Schemas
 *
 * Zod schemas for 13th month pay data validation
 */

import { z } from 'zod';

/**
 * Thirteenth month pay status enum
 */
export const ThirteenthMonthPayStatusSchema = z.enum([
  'pending',
  'calculated',
  'approved',
  'paid',
]);
export type ThirteenthMonthPayStatus = z.infer<
  typeof ThirteenthMonthPayStatusSchema
>;

/**
 * Schema for creating a new 13th month pay record
 */
export const ThirteenthMonthPayCreateSchema = z.object({
  recordId: z.string().min(1, 'Record ID is required').max(150),
  employeeId: z.string().max(50).optional(),
  employeeName: z.string().min(1, 'Employee name is required').max(255),
  year: z.number().int().min(2000).max(2100),
  status: ThirteenthMonthPayStatusSchema.default('calculated'),
  totalBasicSalary: z.number().nonnegative().default(0),
  totalLwop: z.number().nonnegative().default(0),
  totalAbsencesLates: z.number().nonnegative().default(0),
  netBasicSalary: z.number().nonnegative().default(0),
  monthsWorked: z.number().int().min(1).max(12).default(1),
  thirteenthMonthPay: z.number().nonnegative().default(0),
  notes: z.string().optional(),
  calculatedDate: z.string().max(50).optional(),
  approvedDate: z.string().max(50).optional(),
  paidDate: z.string().max(50).optional(),
});

export type ThirteenthMonthPayCreateInput = z.infer<
  typeof ThirteenthMonthPayCreateSchema
>;

/**
 * Schema for updating a 13th month pay record
 */
export const ThirteenthMonthPayUpdateSchema =
  ThirteenthMonthPayCreateSchema.partial().extend({
    id: z.string().cuid(),
  });

export type ThirteenthMonthPayUpdateInput = z.infer<
  typeof ThirteenthMonthPayUpdateSchema
>;

/**
 * Schema for batch create (CSV import)
 */
export const ThirteenthMonthPayBatchCreateSchema = z
  .array(ThirteenthMonthPayCreateSchema)
  .max(10000, 'Maximum 10,000 records per batch');

/**
 * Query filters schema
 */
export const ThirteenthMonthPayQuerySchema = z.object({
  employeeId: z.string().optional(),
  employeeName: z.string().optional(),
  year: z.number().int().optional(),
  status: ThirteenthMonthPayStatusSchema.optional(),
  minAmount: z.number().nonnegative().optional(),
  maxAmount: z.number().nonnegative().optional(),
});

export type ThirteenthMonthPayQuery = z.infer<
  typeof ThirteenthMonthPayQuerySchema
>;
