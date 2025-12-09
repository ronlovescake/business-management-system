/**
 * Cash Advance Validation Schemas
 *
 * Zod schemas for cash advance data validation
 */

import { z } from 'zod';

/**
 * Cash advance status enum
 */
export const CashAdvanceStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'paid',
  'settled',
]);
export type CashAdvanceStatus = z.infer<typeof CashAdvanceStatusSchema>;

/**
 * Cash advance deduction cycle enum
 */
export const CashAdvanceCycleSchema = z.enum(['FIRST_HALF', 'SECOND_HALF']);
export type CashAdvanceCycle = z.infer<typeof CashAdvanceCycleSchema>;

/**
 * Schema for creating a new cash advance
 */
export const CashAdvanceCreateSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required').max(50),
  employeeName: z.string().min(1, 'Employee name is required').max(255),
  amount: z.number().positive('Amount must be positive'),
  termsMonths: z.number().int().positive().optional(),
  monthlyPayment: z.number().positive().optional(),
  settledAmount: z.number().nonnegative().optional(),
  remainingBalance: z.number().nonnegative().optional(),
  purpose: z.string().max(255).optional(),
  notes: z.string().optional(),
  requestDate: z.coerce.date().optional(),
  status: CashAdvanceStatusSchema.default('pending'),
  approvedBy: z.string().max(255).optional(),
  approvedDate: z.coerce.date().optional(),
  rejectedBy: z.string().max(255).optional(),
  rejectedDate: z.coerce.date().optional(),
  rejectionReason: z.string().optional(),
  deductionCycle: CashAdvanceCycleSchema.optional(),
  nextDeductionDate: z.coerce.date().optional(),
  lastDeductedDate: z.coerce.date().optional(),
});

export type CashAdvanceCreateInput = z.infer<typeof CashAdvanceCreateSchema>;

/**
 * Schema for updating a cash advance
 */
export const CashAdvanceUpdateSchema = CashAdvanceCreateSchema.partial().extend(
  {
    id: z.string().cuid(),
  }
);

export type CashAdvanceUpdateInput = z.infer<typeof CashAdvanceUpdateSchema>;

/**
 * Schema for batch create (CSV import)
 */
export const CashAdvanceBatchCreateSchema = z
  .array(CashAdvanceCreateSchema)
  .max(10000, 'Maximum 10,000 cash advances per batch');

/**
 * Schema for batch update
 */
export const CashAdvanceBatchUpdateSchema = z
  .array(CashAdvanceUpdateSchema)
  .max(10000, 'Maximum 10,000 cash advances per batch');

/**
 * Query filters schema
 */
export const CashAdvanceQuerySchema = z.object({
  employeeId: z.string().optional(),
  employeeName: z.string().optional(),
  status: CashAdvanceStatusSchema.optional(),
  minAmount: z.number().nonnegative().optional(),
  maxAmount: z.number().nonnegative().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  hasBalance: z.boolean().optional(), // Filter for records with remaining balance
});

export type CashAdvanceQuery = z.infer<typeof CashAdvanceQuerySchema>;
