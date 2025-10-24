import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { validateMassDeleteConfirmation } from '@/lib/safety/mass-deletion';

/**
 * Expenses API Route
 *
 * Handles CRUD operations for employee expenses:
 * - GET: Fetch all expenses
 * - POST: Create multiple expenses (for CSV import)
 * - PUT: Bulk update multiple expenses
 * - PATCH: Update a single expense
 * - DELETE: Delete all expenses
 */

type ExpenseRow = Record<string, unknown>;

function parseTrimmed(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function parseOptional(value: unknown): string | null {
  const trimmed = parseTrimmed(value);
  return trimmed.length === 0 ? null : trimmed;
}

function parseNumeric(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const str = String(value)
    .replace(/[₱$,\s]/g, '')
    .trim();
  if (str.length === 0) {
    return 0;
  }

  const parsed = Number.parseFloat(str);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// GET - Fetch all expenses
export async function GET() {
  try {
    const expenses = await prisma.expense.findMany({
      orderBy: { date: 'desc' },
    });

    // Convert database format to UI format
    const formattedExpenses = expenses.map((expense) => ({
      id: String(expense.id),
      date: expense.date,
      amount: expense.amount,
      description: expense.description,
      category: expense.category,
      notes: expense.notes ?? '',
      receipt: expense.receipt ?? null,
      status: expense.status,
      employeeName: expense.employeeName ?? undefined,
    }));

    return NextResponse.json(formattedExpenses);
  } catch (error) {
    logger.error('Failed to fetch expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 }
    );
  }
}

// POST - Create multiple expenses (for CSV import)
export async function POST(request: NextRequest) {
  try {
    const expensesData = await request.json();

    if (!Array.isArray(expensesData) || expensesData.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid data format. Expected array of expense objects.',
        },
        { status: 400 }
      );
    }

    const dataToInsert: Prisma.ExpenseCreateManyInput[] = expensesData.map(
      (row: ExpenseRow) => ({
        date: parseTrimmed(row.date),
        amount: parseNumeric(row.amount),
        description: parseTrimmed(row.description),
        category: parseTrimmed(row.category),
        notes: parseOptional(row.notes),
        receipt: parseOptional(row.receipt),
        status: parseTrimmed(row.status) || 'pending',
        employeeName: parseOptional(row.employeeName),
      })
    );

    const result = await prisma.expense.createMany({
      data: dataToInsert,
    });

    return NextResponse.json({
      message: `Successfully imported ${result.count} expense records`,
      count: result.count,
    });
  } catch (error) {
    logger.error('Failed to import expenses:', error);

    if (error instanceof Error) {
      logger.error('Error message:', error.message);
      logger.error('Error stack:', error.stack);
    }

    return NextResponse.json(
      {
        error: 'Failed to import expense data to database',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// PUT - Bulk update multiple expenses
export async function PUT(request: NextRequest) {
  try {
    const updatePayload = await request.json();

    if (!Array.isArray(updatePayload) || updatePayload.length === 0) {
      return NextResponse.json(
        { error: 'Expected array of expenses to update' },
        { status: 400 }
      );
    }

    const updateData = updatePayload as (ExpenseRow & { id: unknown })[];

    // Update each expense in a transaction
    const updatePromises = updateData.map(async (expense) => {
      const id = Number(expense.id);
      if (!Number.isFinite(id)) {
        throw new Error(`Invalid expense ID: ${expense.id}`);
      }

      const dbData: Prisma.ExpenseUpdateInput = {};

      if ('date' in expense) {
        dbData.date = parseTrimmed(expense.date);
      }
      if ('amount' in expense) {
        dbData.amount = parseNumeric(expense.amount);
      }
      if ('description' in expense) {
        dbData.description = parseTrimmed(expense.description);
      }
      if ('category' in expense) {
        dbData.category = parseTrimmed(expense.category);
      }
      if ('notes' in expense) {
        dbData.notes = parseOptional(expense.notes);
      }
      if ('receipt' in expense) {
        dbData.receipt = parseOptional(expense.receipt);
      }
      if ('status' in expense) {
        dbData.status = parseTrimmed(expense.status);
      }
      if ('employeeName' in expense) {
        dbData.employeeName = parseOptional(expense.employeeName);
      }

      return prisma.expense.update({
        where: { id },
        data: dbData,
      });
    });

    const results = await Promise.all(updatePromises);

    return NextResponse.json({
      message: `Successfully updated ${results.length} expenses`,
      count: results.length,
    });
  } catch (error) {
    logger.error('Failed to bulk update expenses:', error);
    return NextResponse.json(
      {
        error: 'Failed to bulk update expenses',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// PATCH - Update a single expense
export async function PATCH(request: NextRequest) {
  try {
    const updatePayload = await request.json();

    if (
      typeof updatePayload !== 'object' ||
      updatePayload === null ||
      (updatePayload as Record<string, unknown>).id === undefined
    ) {
      return NextResponse.json(
        { error: 'Expense ID is required' },
        { status: 400 }
      );
    }

    const updateData = updatePayload as ExpenseRow & { id: unknown };
    const id = Number(updateData.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'Expense ID must be a number' },
        { status: 400 }
      );
    }

    const dbData: Prisma.ExpenseUpdateInput = {};

    if ('date' in updateData) {
      dbData.date = parseTrimmed(updateData.date);
    }
    if ('amount' in updateData) {
      dbData.amount = parseNumeric(updateData.amount);
    }
    if ('description' in updateData) {
      dbData.description = parseTrimmed(updateData.description);
    }
    if ('category' in updateData) {
      dbData.category = parseTrimmed(updateData.category);
    }
    if ('notes' in updateData) {
      dbData.notes = parseOptional(updateData.notes);
    }
    if ('receipt' in updateData) {
      dbData.receipt = parseOptional(updateData.receipt);
    }
    if ('status' in updateData) {
      dbData.status = parseTrimmed(updateData.status);
    }
    if ('employeeName' in updateData) {
      dbData.employeeName = parseOptional(updateData.employeeName);
    }

    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: dbData,
    });

    return NextResponse.json({
      message: 'Expense updated successfully',
      expense: updatedExpense,
    });
  } catch (error) {
    logger.error('Failed to update expense:', error);
    return NextResponse.json(
      {
        error: 'Failed to update expense',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete all expenses
export async function DELETE(request: NextRequest) {
  try {
    // Mass deletion protection - require confirmation token
    const validation = validateMassDeleteConfirmation(request, 'EXPENSES');
    if (validation) {
      return validation;
    }

    const result = await prisma.expense.deleteMany();

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
    logger.error('Failed to delete expenses', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to delete expenses' },
      { status: 500 }
    );
  }
}
