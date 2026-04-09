import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/accounting/journal-lines-by-ref?ref=KPC+23930A-00228
 *
 * Returns journal lines matching a given ref value.
 * Used by the Logistics Costs tab to show posting history for a shipment.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const ref = req.nextUrl.searchParams.get('ref')?.trim();

  if (!ref) {
    return ApiResponse.badRequest('ref query parameter is required');
  }

  const model = (
    prisma as unknown as {
      clothingAccountingJournalLine?: {
        findMany: (args: unknown) => Promise<unknown[]>;
      };
    }
  ).clothingAccountingJournalLine;

  if (!model) {
    return ApiResponse.error(
      'Missing table: clothing_accounting_journal_lines'
    );
  }

  const lines = await model.findMany({
    where: { ref },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      date: true,
      ref: true,
      account: true,
      debit: true,
      credit: true,
      description: true,
      sourceType: true,
      sourceId: true,
      sourceLineKey: true,
    },
  });

  return ApiResponse.success(lines);
});
