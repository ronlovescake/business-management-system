import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { sanitizeString, sanitizeNumber } from '@/lib/security/sanitize';
import {
  cashAdvanceService,
  CashAdvanceQuerySchema,
  CashAdvanceCreateSchema,
  CashAdvanceUpdateSchema,
} from '@/modules/clothing/employees/cash-advance/api';

/**
 * Cash Advances API Route
 *
 * Handles CRUD operations for cash advances using service layer:
 * - GET: Fetch all cash advances with optional filters
 * - POST: Create a new cash advance
 * - PUT: Update an existing cash advance
 * - DELETE: Delete a cash advance or all cash advances
 */

/**
 * GET /api/cash-advances
 *
 * Fetch all cash advances with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const statusParam = searchParams.get('status');
    const employeeIdParam = searchParams.get('employeeId');

    // Build query from search params
    const queryParams = {
      status: statusParam && statusParam !== 'all' ? statusParam : undefined,
      employeeId: employeeIdParam || undefined,
    };

    // Remove undefined values
    const query = Object.fromEntries(
      Object.entries(queryParams).filter(([_, v]) => v !== undefined)
    );

    // Validate query params
    const validatedQuery =
      Object.keys(query).length > 0 ? CashAdvanceQuerySchema.parse(query) : {};

    // Fetch cash advances using service
    const cashAdvances =
      Object.keys(validatedQuery).length > 0
        ? await cashAdvanceService.findWithFilters(validatedQuery)
        : await cashAdvanceService.findAll();

    return NextResponse.json(cashAdvances);
  } catch (error) {
    logger.error('Failed to fetch cash advances', { error });
    return NextResponse.json(
      {
        error: 'Failed to fetch cash advances',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cash-advances
 *
 * Create a new cash advance
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Sanitize and validate input
    const sanitizedData = {
      employeeId: sanitizeString(body.employeeId, { maxLength: 50 }),
      employeeName: sanitizeString(body.employeeName || body.employee, {
        maxLength: 255,
      }),
      amount: sanitizeNumber(body.amount, { min: 0, decimals: 2 }),
      termsMonths: body.termsMonths
        ? Math.floor(sanitizeNumber(body.termsMonths, { min: 1 }) ?? 0) ||
          undefined
        : undefined,
      monthlyPayment: body.monthlyPayment
        ? sanitizeNumber(body.monthlyPayment, { min: 0, decimals: 2 })
        : undefined,
      settledAmount: body.settledAmount
        ? sanitizeNumber(body.settledAmount, { min: 0, decimals: 2 })
        : 0,
      remainingBalance: body.remainingBalance
        ? sanitizeNumber(body.remainingBalance, { min: 0, decimals: 2 })
        : undefined,
      purpose: body.purpose
        ? sanitizeString(body.purpose, { maxLength: 255 })
        : undefined,
      notes: body.notes ? sanitizeString(body.notes) : undefined,
      requestDate: body.requestDate ? new Date(body.requestDate) : new Date(),
      status:
        body.status && typeof body.status === 'string'
          ? sanitizeString(body.status, { maxLength: 50 })
          : 'pending',
      approvedBy: body.approvedBy
        ? sanitizeString(body.approvedBy, { maxLength: 255 })
        : undefined,
      approvedDate: body.approvedDate ? new Date(body.approvedDate) : undefined,
      rejectedBy: body.rejectedBy
        ? sanitizeString(body.rejectedBy, { maxLength: 255 })
        : undefined,
      rejectedDate: body.rejectedDate ? new Date(body.rejectedDate) : undefined,
      rejectionReason: body.rejectionReason
        ? sanitizeString(body.rejectionReason)
        : undefined,
      deductionCycle: body.deductionCycle
        ? sanitizeString(body.deductionCycle, { maxLength: 50 })
        : undefined,
      nextDeductionDate: body.nextDeductionDate
        ? new Date(body.nextDeductionDate)
        : undefined,
      lastDeductedDate: body.lastDeductedDate
        ? new Date(body.lastDeductedDate)
        : undefined,
    };

    // Validate with Zod schema
    const validatedData = CashAdvanceCreateSchema.parse(sanitizedData);

    // Create using service layer
    const record = await cashAdvanceService.create(validatedData);

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    logger.error('Error creating cash advance:', error);

    // Handle validation errors
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create cash advance',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/cash-advances
 *
 * Update an existing cash advance
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const id = sanitizeString(body.id, { maxLength: 50 });

    if (!id) {
      return NextResponse.json(
        { error: 'Cash advance ID is required' },
        { status: 400 }
      );
    }

    // Build update data object with only provided fields
    const updateData: Record<string, unknown> = { id };

    if (body.employeeId !== undefined) {
      updateData.employeeId = sanitizeString(body.employeeId, {
        maxLength: 50,
      });
    }

    if (body.employeeName !== undefined || body.employee !== undefined) {
      updateData.employeeName = sanitizeString(
        body.employeeName || body.employee,
        { maxLength: 255 }
      );
    }

    if (body.amount !== undefined) {
      updateData.amount = sanitizeNumber(body.amount, {
        min: 0,
        decimals: 2,
      });
    }

    if (body.termsMonths !== undefined) {
      updateData.termsMonths =
        body.termsMonths !== null
          ? Math.floor(sanitizeNumber(body.termsMonths, { min: 1 }) ?? 0) ||
            undefined
          : null;
    }

    if (body.monthlyPayment !== undefined) {
      updateData.monthlyPayment = sanitizeNumber(body.monthlyPayment, {
        min: 0,
        decimals: 2,
      });
    }

    if (body.settledAmount !== undefined) {
      updateData.settledAmount = sanitizeNumber(body.settledAmount, {
        min: 0,
        decimals: 2,
      });
    }

    if (body.remainingBalance !== undefined) {
      updateData.remainingBalance = sanitizeNumber(body.remainingBalance, {
        min: 0,
        decimals: 2,
      });
    }

    if (body.purpose !== undefined) {
      updateData.purpose = body.purpose
        ? sanitizeString(body.purpose, { maxLength: 255 })
        : null;
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes ? sanitizeString(body.notes) : null;
    }

    if (body.requestDate !== undefined) {
      updateData.requestDate = new Date(body.requestDate);
    }

    if (body.status !== undefined) {
      updateData.status = sanitizeString(body.status, { maxLength: 50 });
    }

    if (body.approvedBy !== undefined) {
      updateData.approvedBy = body.approvedBy
        ? sanitizeString(body.approvedBy, { maxLength: 255 })
        : null;
    }

    if (body.approvedDate !== undefined) {
      updateData.approvedDate = body.approvedDate
        ? new Date(body.approvedDate)
        : null;
    }

    if (body.rejectedBy !== undefined) {
      updateData.rejectedBy = body.rejectedBy
        ? sanitizeString(body.rejectedBy, { maxLength: 255 })
        : null;
    }

    if (body.rejectedDate !== undefined) {
      updateData.rejectedDate = body.rejectedDate
        ? new Date(body.rejectedDate)
        : null;
    }

    if (body.rejectionReason !== undefined) {
      updateData.rejectionReason = body.rejectionReason
        ? sanitizeString(body.rejectionReason)
        : null;
    }

    if (body.deductionCycle !== undefined) {
      updateData.deductionCycle = body.deductionCycle
        ? sanitizeString(body.deductionCycle, { maxLength: 50 })
        : null;
    }

    if (body.nextDeductionDate !== undefined) {
      updateData.nextDeductionDate = body.nextDeductionDate
        ? new Date(body.nextDeductionDate)
        : null;
    }

    if (body.lastDeductedDate !== undefined) {
      updateData.lastDeductedDate = body.lastDeductedDate
        ? new Date(body.lastDeductedDate)
        : null;
    }

    // Validate with Zod schema
    const validatedData = CashAdvanceUpdateSchema.parse(updateData);

    // Update using service layer
    const record = await cashAdvanceService.update(id, validatedData);

    return NextResponse.json(record);
  } catch (error) {
    logger.error('Error updating cash advance:', error);

    // Handle validation errors
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error,
        },
        { status: 400 }
      );
    }

    // Handle not found errors
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: 'Failed to update cash advance',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cash-advances
 *
 * Delete a cash advance by ID
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Cash advance ID is required' },
        { status: 400 }
      );
    }

    const sanitizedId = sanitizeString(id, { maxLength: 50 });

    // Delete using service layer
    await cashAdvanceService.delete(sanitizedId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting cash advance:', error);

    // Handle not found errors
    if (
      error instanceof Error &&
      (error.message.includes('not found') ||
        error.message.includes('Record to delete does not exist'))
    ) {
      return NextResponse.json(
        { error: 'Cash advance not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to delete cash advance',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
