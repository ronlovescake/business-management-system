/**
 * API Endpoint: Restore Soft-Deleted Records
 *
 * POST /api/employees/restore - Restore deleted employee
 *
 * Implements P2 safety requirement: Upsert/Restore Pattern
 */

import type { NextRequest } from 'next/server';
import {
  restoreRecord,
  bulkRestore,
  findDeletedRecords,
} from '@/lib/safety/restore';
import { z } from 'zod';
import { sanitizers } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';

// Validation schemas
const restoreSchema = z.object({
  id: z.string().uuid('Invalid record ID format'),
  reason: z.string().optional(),
  userId: z.string().optional(),
});

const bulkRestoreSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one ID required'),
  userId: z.string().optional(),
});

function formatValidationErrors(error: z.ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};
  const flattened = error.flatten();

  for (const [field, messages] of Object.entries(flattened.fieldErrors)) {
    if (messages && messages.length > 0) {
      formatted[field] = messages[0];
    }
  }

  if (flattened.formErrors.length > 0) {
    formatted.form = flattened.formErrors[0];
  }

  return formatted;
}

/**
 * POST - Restore a soft-deleted employee
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const validation = restoreSchema.safeParse(body);

    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        formatValidationErrors(validation.error)
      );
    }

    const { id, reason, userId } = validation.data;
    const result = await restoreRecord({
      model: 'employee',
      id,
      reason,
      userId,
    });

    if (!result.success) {
      return ApiResponse.error(
        result.error ?? 'Failed to restore employee',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    return ApiResponse.success(
      {
        record: result.record,
        warnings: result.warnings,
      },
      'Employee restored successfully'
    );
  } catch (error) {
    logger.error('Restore employee error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return ApiResponse.error(
      'Failed to restore employee',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : undefined
    );
  }
});

/**
 * GET - List soft-deleted employees
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get('limit');
    const departmentParam = searchParams.get('department');

    const limit = limitParam
      ? (sanitizers.number(limitParam, { min: 1, max: 100 }) ?? 50)
      : 50;
    const department = departmentParam
      ? sanitizers.name(departmentParam)
      : undefined;

    const filters: Record<string, unknown> = {};
    if (department) {
      filters.department = department;
    }

    const deleted = await findDeletedRecords('employee', filters);
    const results = deleted.slice(0, limit);

    return ApiResponse.success(
      {
        count: results.length,
        total: deleted.length,
        data: results,
      },
      'Deleted employees fetched'
    );
  } catch (error) {
    logger.error('List deleted employees error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return ApiResponse.error(
      'Failed to list deleted employees',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : undefined
    );
  }
});

/**
 * PUT - Bulk restore multiple employees
 */
export const PUT = withErrorHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const validation = bulkRestoreSchema.safeParse(body);

    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        formatValidationErrors(validation.error)
      );
    }

    const { ids, userId } = validation.data;
    const results = await bulkRestore('employee', ids, userId);

    const status =
      results.failed > 0 ? HTTP_STATUS.MULTI_STATUS : HTTP_STATUS.OK;

    return ApiResponse.success(
      {
        message: `Restored ${results.success} of ${ids.length} employees`,
        success: results.success,
        failed: results.failed,
        errors: results.errors,
      },
      'Bulk employee restore completed',
      status
    );
  } catch (error) {
    logger.error('Bulk restore error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return ApiResponse.error(
      'Failed to bulk restore employees',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : undefined
    );
  }
});
