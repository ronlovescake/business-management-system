import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * DELETE /api/payroll/cleanup
 * Permanently deletes soft-deleted payroll records for a specific period
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'periodStart and periodEnd are required' },
        { status: 400 }
      );
    }

    // Permanently delete soft-deleted payroll records for this period
    const result = await prisma.truckingPayroll.deleteMany({
      where: {
        periodStart,
        periodEnd,
        deletedAt: { not: null },
      },
    });

    logger.info('Soft-deleted payroll records permanently removed', {
      periodStart,
      periodEnd,
      count: result.count,
    });

    return NextResponse.json({
      success: true,
      message: `${result.count} soft-deleted payroll record(s) permanently removed`,
      count: result.count,
    });
  } catch (error) {
    logger.error('Failed to cleanup soft-deleted payroll records', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to cleanup payroll records' },
      { status: 500 }
    );
  }
}
