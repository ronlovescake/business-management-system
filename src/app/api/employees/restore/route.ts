/**
 * API Endpoint: Restore Soft-Deleted Records
 *
 * POST /api/employees/restore - Restore deleted employee
 *
 * Implements P2 safety requirement: Upsert/Restore Pattern
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  restoreRecord,
  bulkRestore,
  findDeletedRecords,
} from '@/lib/safety/restore';
import { z } from 'zod';
import { sanitizers } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';

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

/**
 * POST - Restore a soft-deleted employee
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validation = restoreSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const { id, reason, userId } = validation.data;

    // Attempt restore
    const result = await restoreRecord({
      model: 'employee',
      id,
      reason,
      userId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          warnings: result.warnings,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: 'Employee restored successfully',
        data: result.record,
        warnings: result.warnings,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Restore employee error:', error);
    return NextResponse.json(
      {
        error: 'Failed to restore employee',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET - List soft-deleted employees
 */
export async function GET(request: NextRequest) {
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

    // Build filters
    const filters: Record<string, unknown> = {};
    if (department) {
      filters.department = department;
    }

    const deleted = await findDeletedRecords('employee', filters);

    // Limit results
    const results = deleted.slice(0, limit);

    return NextResponse.json(
      {
        count: results.length,
        total: deleted.length,
        data: results,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('List deleted employees error:', error);
    return NextResponse.json(
      {
        error: 'Failed to list deleted employees',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT - Bulk restore multiple employees
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validation = bulkRestoreSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const { ids, userId } = validation.data;

    // Attempt bulk restore
    const results = await bulkRestore('employee', ids, userId);

    const status = results.failed > 0 ? 207 : 200; // 207 = Multi-Status

    return NextResponse.json(
      {
        message: `Restored ${results.success} of ${ids.length} employees`,
        success: results.success,
        failed: results.failed,
        errors: results.errors,
      },
      { status }
    );
  } catch (error) {
    logger.error('Bulk restore error:', error);
    return NextResponse.json(
      {
        error: 'Failed to bulk restore employees',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
