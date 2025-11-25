/**
 * Leave Request Validation Schemas
 *
 * Zod schemas for runtime validation of leave request data
 */

import { z } from 'zod';

/**
 * Leave status enum
 */
export const LeaveStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type LeaveStatus = z.infer<typeof LeaveStatusSchema>;

/**
 * Payment status enum
 */
export const PaymentStatusSchema = z.enum(['paid', 'unpaid', 'not-applicable']);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

/**
 * Schema for creating a new leave request
 */
export const LeaveRequestCreateSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  employeeName: z.string().min(1, 'Employee name is required'),
  leaveType: z.string().min(1, 'Leave type is required'),
  paymentStatus: PaymentStatusSchema.default('unpaid'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  numberOfDays: z
    .number()
    .positive('Number of days must be positive')
    .optional(),
  reason: z.string().min(1, 'Reason is required'),
  status: LeaveStatusSchema.default('pending'),
  appliedDate: z.string().optional(),
  approvedBy: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type LeaveRequestCreate = z.infer<typeof LeaveRequestCreateSchema>;

/**
 * Schema for updating a leave request
 */
export const LeaveRequestUpdateSchema = z.object({
  employeeId: z.string().min(1).optional(),
  employeeName: z.string().min(1).optional(),
  leaveType: z.string().min(1).optional(),
  paymentStatus: PaymentStatusSchema.optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  numberOfDays: z.number().positive().optional(),
  reason: z.string().min(1).optional(),
  status: LeaveStatusSchema.optional(),
  appliedDate: z.string().optional(),
  approvedBy: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type LeaveRequestUpdate = z.infer<typeof LeaveRequestUpdateSchema>;

/**
 * Schema for batch create operations
 */
export const LeaveRequestBatchCreateSchema = z
  .array(LeaveRequestCreateSchema)
  .min(1, 'At least one leave request is required')
  .max(10000, 'Maximum 10,000 records per batch');

/**
 * Schema for leave request with ID (response)
 */
export const LeaveRequestSchema = LeaveRequestCreateSchema.extend({
  id: z.number().positive(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type LeaveRequest = z.infer<typeof LeaveRequestSchema>;

/**
 * Schema for query parameters
 */
export const LeaveRequestQuerySchema = z.object({
  employeeId: z.string().optional(),
  status: LeaveStatusSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type LeaveRequestQuery = z.infer<typeof LeaveRequestQuerySchema>;
