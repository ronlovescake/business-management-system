import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Single Expense API Route
 * Handles operations on individual expense records by ID
 */

// GET - Fetch a single expense by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);

    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'Invalid expense ID' },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.findFirst({
      where: { id, deletedAt: null },
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    return NextResponse.json(expense);
  } catch (error) {
    logger.error('Failed to fetch expense:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expense' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a single expense by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);

    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'Invalid expense ID' },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.findFirst({
      where: { id, deletedAt: null },
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const deletedExpense = await prisma.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({
      message: 'Expense deleted successfully',
      expense: deletedExpense,
    });
  } catch (error) {
    logger.error('Failed to delete expense:', error);

    // Check if it's a "record not found" error
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: 'Failed to delete expense',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
