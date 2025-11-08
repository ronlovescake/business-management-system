import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * DELETE /api/transactions/[id]
 * Soft-delete a single transaction by ID
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);

    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    // Check if transaction exists
    const existing = await prisma.transaction.findUnique({
      where: { id },
      select: { id: true, deletedAt: true, customers: true, productCode: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    if (existing.deletedAt) {
      return NextResponse.json(
        { error: 'Transaction already deleted' },
        { status: 400 }
      );
    }

    // Soft delete
    await prisma.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    logger.info(
      `✅ Soft deleted transaction ${id} (${existing.customers} - ${existing.productCode})`
    );

    return NextResponse.json({
      success: true,
      message: 'Transaction deleted successfully',
      id,
    });
  } catch (error) {
    logger.error('Failed to delete transaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/transactions/[id]/restore
 * Restore a soft-deleted transaction
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action !== 'restore') {
      return NextResponse.json(
        {
          error:
            'Invalid action. Use ?action=restore to restore a deleted transaction',
        },
        { status: 400 }
      );
    }

    const id = Number(params.id);

    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    // Check if transaction exists and is deleted
    const existing = await prisma.transaction.findUnique({
      where: { id },
      select: { id: true, deletedAt: true, customers: true, productCode: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    if (!existing.deletedAt) {
      return NextResponse.json(
        { error: 'Transaction is not deleted' },
        { status: 400 }
      );
    }

    // Restore by setting deletedAt to null
    await prisma.transaction.update({
      where: { id },
      data: { deletedAt: null },
    });

    logger.info(
      `✅ Restored transaction ${id} (${existing.customers} - ${existing.productCode})`
    );

    return NextResponse.json({
      success: true,
      message: 'Transaction restored successfully',
      id,
    });
  } catch (error) {
    logger.error('Failed to restore transaction:', error);
    return NextResponse.json(
      { error: 'Failed to restore transaction' },
      { status: 500 }
    );
  }
}
