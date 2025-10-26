import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { validateMassDeleteConfirmation } from '@/lib/safety/mass-deletion';
import {
  expenseService,
  ExpenseQuerySchema,
  ExpenseBatchCreateSchema,
} from '@/modules/clothing/employees/expenses/api';

/**
 * Expenses API Route
 *
 * Handles CRUD operations for employee expenses using service layer:
 * - GET: Fetch all expenses with optional filters
 * - POST: Create multiple expenses (for CSV import)
 * - PUT: Bulk update multiple expenses
 * - PATCH: Update a single expense
 * - DELETE: Delete all expenses
 */

/**
 * GET /api/expenses
 *
 * Fetch all expenses with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Build query from search params
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const minAmountParam = searchParams.get('minAmount');
    const maxAmountParam = searchParams.get('maxAmount');

    const queryParams = {
      category: searchParams.get('category') || undefined,
      status: searchParams.get('status') || undefined,
      startDate: startDateParam ? new Date(startDateParam) : undefined,
      endDate: endDateParam ? new Date(endDateParam) : undefined,
      employeeName: searchParams.get('employeeName') || undefined,
      minAmount: minAmountParam ? Number(minAmountParam) : undefined,
      maxAmount: maxAmountParam ? Number(maxAmountParam) : undefined,
    };

    // Remove undefined values
    const query = Object.fromEntries(
      Object.entries(queryParams).filter(([_, v]) => v !== undefined)
    );

    // Validate query params
    const validatedQuery =
      Object.keys(query).length > 0 ? ExpenseQuerySchema.parse(query) : {};

    // Fetch expenses using service
    const expenses =
      Object.keys(validatedQuery).length > 0
        ? await expenseService.findWithFilters(validatedQuery)
        : await expenseService.findAll();

    return NextResponse.json(expenses);
  } catch (error) {
    logger.error('Failed to fetch expenses', { error });
    return NextResponse.json(
      {
        error: 'Failed to fetch expenses',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/expenses
 *
 * Create multiple expenses (batch import)
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const items = Array.isArray(payload) ? payload : [payload];

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Request body must contain one or more expenses' },
        { status: 400 }
      );
    }

    // Validate batch size (max 10,000)
    const validatedData = ExpenseBatchCreateSchema.parse(items);

    // Create expenses using service
    const result = await expenseService.createMany(validatedData);

    logger.info('Expenses created', { count: result.count });

    return NextResponse.json({
      message: `Successfully imported ${result.count} expense records`,
      count: result.count,
    });
  } catch (error) {
    logger.error('Failed to import expenses', { error });

    // Handle validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to import expenses',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/expenses
 *
 * Bulk update multiple expenses
 */
export async function PUT(request: NextRequest) {
  try {
    const updatePayload = await request.json();

    if (!Array.isArray(updatePayload) || updatePayload.length === 0) {
      return NextResponse.json(
        { error: 'Expected array of expenses to update' },
        { status: 400 }
      );
    }

    // Update each expense using service
    const updatePromises = updatePayload.map(async (expense) => {
      const id = Number(expense.id);
      if (!Number.isFinite(id)) {
        throw new Error(`Invalid expense ID: ${expense.id}`);
      }

      const { id: _, ...updateData } = expense;
      return expenseService.update(id, updateData);
    });

    const results = await Promise.all(updatePromises);

    return NextResponse.json({
      message: `Successfully updated ${results.length} expenses`,
      count: results.length,
    });
  } catch (error) {
    logger.error('Failed to bulk update expenses', { error });
    return NextResponse.json(
      {
        error: 'Failed to bulk update expenses',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/expenses
 *
 * Update a single expense
 */
export async function PATCH(request: NextRequest) {
  try {
    const updatePayload = await request.json();

    if (
      typeof updatePayload !== 'object' ||
      updatePayload === null ||
      updatePayload.id === undefined
    ) {
      return NextResponse.json(
        { error: 'Expense ID is required' },
        { status: 400 }
      );
    }

    const id = Number(updatePayload.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'Expense ID must be a number' },
        { status: 400 }
      );
    }

    const { id: _, ...updateData } = updatePayload;

    const updatedExpense = await expenseService.update(id, updateData);

    return NextResponse.json({
      message: 'Expense updated successfully',
      expense: updatedExpense,
    });
  } catch (error) {
    logger.error('Failed to update expense', { error });
    return NextResponse.json(
      {
        error: 'Failed to update expense',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/expenses
 *
 * Delete all expenses (requires mass deletion confirmation)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Mass deletion protection - require confirmation token
    const validation = validateMassDeleteConfirmation(request, 'EXPENSES');
    if (validation) {
      return validation;
    }

    const result = await expenseService.deleteAll();

    logger.warn('Mass deletion executed', {
      entity: 'expenses',
      count: result.count,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      message: `Successfully deleted ${result.count} expense records`,
      count: result.count,
    });
  } catch (error) {
    logger.error('Failed to delete expenses', { error });

    return NextResponse.json(
      { error: 'Failed to delete expenses' },
      { status: 500 }
    );
  }
}
