import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  thirteenthMonthPayService,
  ThirteenthMonthPayQuerySchema,
} from '@/modules/clothing/employees/thirteenth-month-pay/api';

/**
 * Thirteenth Month Pay API Route
 *
 * Handles CRUD operations for 13th month pay using service layer:
 * - GET: Fetch all records with optional filters
 * - PATCH: Create or update a record (upsert)
 */

/**
 * GET /api/thirteenth-month-pay
 *
 * Fetch all 13th month pay records with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Build query from search params
    const queryParams = {
      employeeId: searchParams.get('employeeId') || undefined,
      year: searchParams.get('year')
        ? Number(searchParams.get('year'))
        : undefined,
      status: searchParams.get('status') || undefined,
    };

    // Remove undefined values
    const query = Object.fromEntries(
      Object.entries(queryParams).filter(([_, v]) => v !== undefined)
    );

    // Validate query params
    const validatedQuery =
      Object.keys(query).length > 0
        ? ThirteenthMonthPayQuerySchema.parse(query)
        : {};

    // Fetch records using service
    const records =
      Object.keys(validatedQuery).length > 0
        ? await thirteenthMonthPayService.findWithFilters(validatedQuery)
        : await thirteenthMonthPayService.findAll();

    return NextResponse.json(records);
  } catch (error) {
    logger.error('Failed to fetch 13th month pay records', { error });
    return NextResponse.json(
      {
        error: 'Failed to load 13th month pay records',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/thirteenth-month-pay
 *
 * Create or update a 13th month pay record (upsert)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { id: recordId, ...data } = body;

    if (typeof recordId !== 'string' || recordId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Record ID is required' },
        { status: 400 }
      );
    }

    // Check if record exists
    const existing = await thirteenthMonthPayService.findByRecordId(recordId);

    let result;
    if (existing) {
      // Update existing record
      result = await thirteenthMonthPayService.update(existing.id, data);
    } else {
      // Create new record
      result = await thirteenthMonthPayService.create({
        recordId,
        ...data,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Failed to persist 13th month pay record', { error });
    return NextResponse.json(
      {
        error: 'Failed to persist record',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
