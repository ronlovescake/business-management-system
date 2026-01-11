import type { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { parseDateRangeFromParams } from '@/lib/accounting/date-utils';
import { prisma } from '@/lib/db';

const CUTOVER = new Date('2026-01-01T00:00:00.000Z');

function serialize(entry: {
  id: string;
  date: Date;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string | null;
}) {
  return {
    id: entry.id,
    date: entry.date.toISOString(),
    ref: entry.ref,
    account: entry.account,
    debit: entry.debit,
    credit: entry.credit,
    description: entry.description ?? '',
  };
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { from, to } = parseDateRangeFromParams(req.nextUrl.searchParams);

  const where: Prisma.ClothingAccountingOpeningBalanceWhereInput = {};
  if (from || to) {
    where.date = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const entries = await prisma.clothingAccountingOpeningBalance.findMany({
    where,
    orderBy: { date: 'asc' },
  });

  return ApiResponse.success({ entries: entries.map(serialize) });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) ?? {};

  const account = (body.account ?? '').trim();
  const ref = (body.ref ?? '').trim() || 'OPENING';
  const description = (body.description ?? '').trim();
  const debit = Number(body.debit ?? 0);
  const credit = Number(body.credit ?? 0);

  if (!account) {
    return ApiResponse.badRequest('Account is required.');
  }

  if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
    return ApiResponse.badRequest('Amounts must be valid numbers.');
  }

  if (debit > 0 && credit > 0) {
    return ApiResponse.badRequest(
      'Provide either a debit or a credit, not both.'
    );
  }

  if (debit <= 0 && credit <= 0) {
    return ApiResponse.badRequest('Provide a debit or a credit amount.');
  }

  const normalizedDate = new Date(
    Date.UTC(
      CUTOVER.getUTCFullYear(),
      CUTOVER.getUTCMonth(),
      CUTOVER.getUTCDate()
    )
  );

  const entry = await prisma.clothingAccountingOpeningBalance.create({
    data: {
      date: normalizedDate,
      ref,
      account,
      debit: debit > 0 ? debit : 0,
      credit: credit > 0 ? credit : 0,
      description: description || null,
    },
  });

  return ApiResponse.success(
    { entry: serialize(entry) },
    'Opening balance entry saved'
  );
});
