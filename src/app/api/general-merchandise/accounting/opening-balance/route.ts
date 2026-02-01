import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { parseDateRangeFromParams } from '@/lib/accounting/date-utils';
import { getAccountingCutoverDate } from '@/lib/accounting/cutover';
import { normalizeAccountForReporting } from '@/lib/accounting/account-normalization';
import { prisma } from '@/lib/db';

const CUTOVER = getAccountingCutoverDate('generalMerchandise');

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
    account: normalizeAccountForReporting(entry.account),
    debit: entry.debit,
    credit: entry.credit,
    description: entry.description ?? '',
  };
}

function getOpeningBalanceModel() {
  return (
    prisma as unknown as {
      generalMerchandiseAccountingOpeningBalance?: {
        findMany?: (args: unknown) => Promise<unknown>;
        create?: (args: unknown) => Promise<unknown>;
        update?: (args: unknown) => Promise<unknown>;
        delete?: (args: unknown) => Promise<unknown>;
      };
    }
  ).generalMerchandiseAccountingOpeningBalance;
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { from, to } = parseDateRangeFromParams(req.nextUrl.searchParams);

  const where: { date?: { gte?: Date; lte?: Date } } = {};
  if (from || to) {
    where.date = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const openingBalanceModel = getOpeningBalanceModel();

  const entries = openingBalanceModel?.findMany
    ? ((await openingBalanceModel.findMany({
        where,
        orderBy: { date: 'asc' },
      })) as Array<{
        id: string;
        date: Date;
        ref: string;
        account: string;
        debit: number;
        credit: number;
        description: string | null;
      }>)
    : [];

  return ApiResponse.success({
    cutoverDate: normalizedCutoverDate().toISOString().slice(0, 10),
    entries: entries.map(serialize),
  });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) ?? {};

  const validation = validateOpeningBalancePayload(body);
  if (!validation.ok) {
    return ApiResponse.badRequest(validation.errorMessage);
  }

  const { account, ref, description, debit, credit } = validation.value;

  const openingBalanceModel = getOpeningBalanceModel();
  if (!openingBalanceModel?.create) {
    return ApiResponse.error(
      'Opening balances are not enabled in this database yet',
      503,
      'Missing table: general_merchandise.accounting_opening_balances. Create/apply the required schema to enable opening balances.'
    );
  }

  const entry = (await openingBalanceModel.create({
    data: {
      date: normalizedCutoverDate(),
      ref,
      account,
      debit,
      credit,
      description,
    },
  })) as {
    id: string;
    date: Date;
    ref: string;
    account: string;
    debit: number;
    credit: number;
    description: string | null;
  };

  return ApiResponse.success(
    { entry: serialize(entry) },
    'Opening balance entry saved'
  );
});

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) ?? {};
  const id = (body.id ?? '').trim();

  if (!id) {
    return ApiResponse.badRequest('Opening balance id is required.');
  }

  const validation = validateOpeningBalancePayload(body);
  if (!validation.ok) {
    return ApiResponse.badRequest(validation.errorMessage);
  }

  const { account, ref, description, debit, credit } = validation.value;

  const openingBalanceModel = getOpeningBalanceModel();
  if (!openingBalanceModel?.update) {
    return ApiResponse.error(
      'Opening balances are not enabled in this database yet',
      503,
      'Missing table: general_merchandise.accounting_opening_balances. Create/apply the required schema to enable opening balances.'
    );
  }

  const entry = (await openingBalanceModel.update({
    where: { id },
    data: {
      date: normalizedCutoverDate(),
      ref,
      account,
      debit,
      credit,
      description,
    },
  })) as {
    id: string;
    date: Date;
    ref: string;
    account: string;
    debit: number;
    credit: number;
    description: string | null;
  };

  return ApiResponse.success(
    { entry: serialize(entry) },
    'Opening balance entry updated'
  );
});

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const id = (searchParams.get('id') ?? '').trim();

  if (!id) {
    return ApiResponse.badRequest('Opening balance id is required.');
  }

  const openingBalanceModel = getOpeningBalanceModel();
  if (!openingBalanceModel?.delete) {
    return ApiResponse.error(
      'Opening balances are not enabled in this database yet',
      503,
      'Missing table: general_merchandise.accounting_opening_balances. Create/apply the required schema to enable opening balances.'
    );
  }

  await openingBalanceModel.delete({ where: { id } });

  return ApiResponse.success({ id }, 'Opening balance entry deleted');
});

function normalizedCutoverDate() {
  return new Date(
    Date.UTC(
      CUTOVER.getUTCFullYear(),
      CUTOVER.getUTCMonth(),
      CUTOVER.getUTCDate()
    )
  );
}

function validateOpeningBalancePayload(body: unknown):
  | {
      ok: true;
      value: {
        account: string;
        ref: string;
        description: string | null;
        debit: number;
        credit: number;
      };
    }
  | { ok: false; errorMessage: string } {
  const payload = (body as Record<string, unknown>) ?? {};

  const account = normalizeAccountForReporting(
    (payload.account ?? '').toString().trim()
  ).trim();
  const ref = ((payload.ref as string) ?? '').trim() || 'OPENING';
  const description = ((payload.description as string) ?? '').trim();
  const debit = Number(payload.debit ?? 0);
  const credit = Number(payload.credit ?? 0);

  if (!account) {
    return { ok: false, errorMessage: 'Account is required.' };
  }

  if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
    return { ok: false, errorMessage: 'Amounts must be valid numbers.' };
  }

  if (debit > 0 && credit > 0) {
    return {
      ok: false,
      errorMessage: 'Provide either a debit or a credit, not both.',
    };
  }

  if (debit <= 0 && credit <= 0) {
    return {
      ok: false,
      errorMessage: 'Provide a debit or a credit amount.',
    };
  }

  return {
    ok: true,
    value: {
      account,
      ref,
      description: description || null,
      debit: debit > 0 ? debit : 0,
      credit: credit > 0 ? credit : 0,
    },
  };
}
