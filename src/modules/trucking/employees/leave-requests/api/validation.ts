/**
 * Leave Request Validation
 *
 * Validation functions for leave request data using Zod schemas
 */

import { z } from 'zod';
import {
  LeaveRequestCreateSchema,
  LeaveRequestUpdateSchema,
  LeaveRequestBatchCreateSchema,
  LeaveRequestQuerySchema,
  type LeaveRequestCreate,
  type LeaveRequestUpdate,
} from './schemas';
import { getCurrentDateISO } from '@/utils/date';

/**
 * Validation result type
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError };

/**
 * Calculate number of days between start and end dates
 */
function calculateNumberOfDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) {
    return 0;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

/**
 * Validate and transform data for creating a leave request
 */
export function validateCreateLeaveRequest(
  data: unknown
): ValidationResult<LeaveRequestCreate> {
  try {
    // Parse with Zod schema
    const parsed = LeaveRequestCreateSchema.parse(data);

    // Apply defaults and transformations
    const transformed: LeaveRequestCreate = {
      ...parsed,
      appliedDate: parsed.appliedDate || getCurrentDateISO(),
      numberOfDays:
        parsed.numberOfDays ||
        calculateNumberOfDays(parsed.startDate, parsed.endDate),
      approvedBy: parsed.approvedBy ?? null,
      notes: parsed.notes ?? null,
    };

    // Ensure numberOfDays is calculated if not provided or invalid
    if (!transformed.numberOfDays || transformed.numberOfDays <= 0) {
      transformed.numberOfDays = calculateNumberOfDays(
        transformed.startDate,
        transformed.endDate
      );
    }

    return { success: true, data: transformed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error };
    }
    throw error;
  }
}

/**
 * Validate and transform data for updating a leave request
 */
export function validateUpdateLeaveRequest(
  data: unknown
): ValidationResult<LeaveRequestUpdate> {
  try {
    const parsed = LeaveRequestUpdateSchema.parse(data);

    // Recalculate numberOfDays if dates are being updated
    if (parsed.startDate || parsed.endDate) {
      const currentData = data as Record<string, unknown>;
      const startDate = (parsed.startDate || currentData.startDate) as string;
      const endDate = (parsed.endDate || currentData.endDate) as string;

      if (startDate && endDate && !parsed.numberOfDays) {
        parsed.numberOfDays = calculateNumberOfDays(startDate, endDate);
      }
    }

    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error };
    }
    throw error;
  }
}

/**
 * Validate batch create operation
 */
export function validateBatchCreate(
  data: unknown
): ValidationResult<LeaveRequestCreate[]> {
  try {
    // Ensure data is an array
    const items = Array.isArray(data) ? data : [data];

    // Validate with batch schema
    const parsedItems = LeaveRequestBatchCreateSchema.parse(items);

    // Transform each item
    const transformed = parsedItems.map((item) => {
      const result = validateCreateLeaveRequest(item);
      if (!result.success) {
        throw result.error;
      }
      return result.data;
    });

    return { success: true, data: transformed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error };
    }
    throw error;
  }
}

/**
 * Validate query parameters
 */
export function validateQuery(
  params: unknown
): ValidationResult<z.infer<typeof LeaveRequestQuerySchema>> {
  try {
    const parsed = LeaveRequestQuerySchema.parse(params);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error };
    }
    throw error;
  }
}

/**
 * Convert Zod error to user-friendly error object
 */
export function formatZodError(error: z.ZodError): {
  error: string;
  details: string;
  validationErrors: Record<string, string>;
} {
  const validationErrors: Record<string, string> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    validationErrors[path] = err.message;
  });

  return {
    error: 'Validation failed',
    details: error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', '),
    validationErrors,
  };
}
