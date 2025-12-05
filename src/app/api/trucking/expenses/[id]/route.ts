import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { expenseService } from '@/modules/trucking/employees/expenses/api';

/**
 * Trucking Expense Detail API Route
 * Handles GET and DELETE operations for a single trucking expense record.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid expense ID' }, { status: 400 });
  }

  try {
    const expense = await expenseService.findById(id);

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    return NextResponse.json(expense);
  } catch (error) {
    logger.error('Failed to fetch trucking expense', { error, id });

    return NextResponse.json(
      {
        error: 'Failed to fetch expense',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid expense ID' }, { status: 400 });
  }

  try {
    await expenseService.delete(id);

    return NextResponse.json({
      message: 'Expense deleted successfully',
      id,
    });
  } catch (error) {
    logger.error('Failed to delete trucking expense', { error, id });

    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: 'Failed to delete expense',
        details: message,
      },
      { status: 500 }
    );
  }
}
