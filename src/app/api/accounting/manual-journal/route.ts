import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { parseDate } from '@/lib/accounting/date-utils';
import { prisma } from '@/lib/db';

const CUTOVER = new Date(Date.UTC(2026, 0, 1));

type ManualJournalPayload = {
  sourceId?: string;
  date: string;
  ref: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  description?: string;
};

function normalizedDateOrNull(raw: unknown): Date | null {
  const date = parseDate(typeof raw === 'string' ? raw : null);
  if (!date) {
    return null;
  }

  // Normalize to UTC midnight to keep ordering stable.
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function validate(
  body: unknown
):
  | { ok: true; value: ManualJournalPayload }
  | { ok: false; errorMessage: string } {
  const payload = (body as Record<string, unknown>) ?? {};

  const sourceId = (payload.sourceId ?? '').toString().trim();
  const date = (payload.date ?? '').toString().trim();
  const ref = (payload.ref ?? '').toString().trim();
  const debitAccount = (payload.debitAccount ?? '').toString().trim();
  const creditAccount = (payload.creditAccount ?? '').toString().trim();
  const amount = Number(payload.amount ?? 0);
  const description = (payload.description ?? '').toString().trim();

  if (!date) {
    return { ok: false, errorMessage: 'Date is required.' };
  }

  if (!ref) {
    return { ok: false, errorMessage: 'Reference is required.' };
  }

  if (!debitAccount || !creditAccount) {
    return {
      ok: false,
      errorMessage: 'Debit and credit accounts are required.',
    };
  }

  if (debitAccount === creditAccount) {
    return {
      ok: false,
      errorMessage: 'Debit and credit accounts must be different.',
    };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, errorMessage: 'Amount must be a positive number.' };
  }

  const normalizedDate = normalizedDateOrNull(date);
  if (!normalizedDate) {
    return { ok: false, errorMessage: 'Date must be a valid date.' };
  }

  if (normalizedDate < CUTOVER) {
    return {
      ok: false,
      errorMessage:
        'Manual journal entries are only allowed from 2026-01-01 onward.',
    };
  }

  return {
    ok: true,
    value: {
      sourceId: sourceId || undefined,
      date,
      ref,
      debitAccount,
      creditAccount,
      amount,
      description: description || undefined,
    },
  };
}

function isMissingTableError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message ?? '';
  return code === 'P2021' || message.includes('does not exist');
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) ?? {};

  const validation = validate(body);
  if (!validation.ok) {
    return ApiResponse.badRequest(validation.errorMessage);
  }

  const { date, ref, debitAccount, creditAccount, amount, description } =
    validation.value;

  const entryDate = normalizedDateOrNull(date);
  if (!entryDate) {
    return ApiResponse.badRequest('Date must be a valid date.');
  }

  const sourceId = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  let created: { debitLine: unknown; creditLine: unknown; sourceId: string };
  try {
    created = await prisma.$transaction(async (tx) => {
      const debitLine = await tx.clothingAccountingJournalLine.create({
        data: {
          date: entryDate,
          ref,
          account: debitAccount,
          debit: amount,
          credit: 0,
          description: description || null,
          sourceType: 'MANUAL',
          sourceId,
          sourceLineKey: 'debit',
          systemGenerated: false,
        },
      });

      const creditLine = await tx.clothingAccountingJournalLine.create({
        data: {
          date: entryDate,
          ref,
          account: creditAccount,
          debit: 0,
          credit: amount,
          description: description || null,
          sourceType: 'MANUAL',
          sourceId,
          sourceLineKey: 'credit',
          systemGenerated: false,
        },
      });

      return { debitLine, creditLine, sourceId };
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      return ApiResponse.error(
        'Manual journal entries are not enabled in this database yet',
        503,
        'Missing table: clothing_accounting_journal_lines. Create/apply the required schema to enable manual entries.'
      );
    }
    throw error;
  }

  return ApiResponse.success(
    {
      entry: {
        sourceId: created.sourceId,
        date: entryDate.toISOString(),
        ref,
        amount,
        debitAccount,
        creditAccount,
        description: description || '',
      },
    },
    'Manual journal entry saved'
  );
});

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) ?? {};

  const validation = validate(body);
  if (!validation.ok) {
    return ApiResponse.badRequest(validation.errorMessage);
  }

  const {
    sourceId,
    date,
    ref,
    debitAccount,
    creditAccount,
    amount,
    description,
  } = validation.value;

  if (!sourceId) {
    return ApiResponse.badRequest('sourceId is required for editing an entry.');
  }

  const entryDate = normalizedDateOrNull(date);
  if (!entryDate) {
    return ApiResponse.badRequest('Date must be a valid date.');
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.clothingAccountingJournalLine.findMany({
        where: {
          sourceType: 'MANUAL',
          sourceId,
          systemGenerated: false,
          sourceLineKey: { in: ['debit', 'credit'] },
        },
        select: { id: true, sourceLineKey: true },
      });

      const hasDebit = existing.some((r) => r.sourceLineKey === 'debit');
      const hasCredit = existing.some((r) => r.sourceLineKey === 'credit');
      if (!hasDebit || !hasCredit) {
        return { ok: false as const };
      }

      await tx.clothingAccountingJournalLine.updateMany({
        where: {
          sourceType: 'MANUAL',
          sourceId,
          systemGenerated: false,
          sourceLineKey: 'debit',
        },
        data: {
          date: entryDate,
          ref,
          account: debitAccount,
          debit: amount,
          credit: 0,
          description: description || null,
        },
      });

      await tx.clothingAccountingJournalLine.updateMany({
        where: {
          sourceType: 'MANUAL',
          sourceId,
          systemGenerated: false,
          sourceLineKey: 'credit',
        },
        data: {
          date: entryDate,
          ref,
          account: creditAccount,
          debit: 0,
          credit: amount,
          description: description || null,
        },
      });

      return { ok: true as const };
    });

    if (!result.ok) {
      return ApiResponse.notFound('Manual journal entry');
    }
  } catch (error) {
    if (isMissingTableError(error)) {
      return ApiResponse.error(
        'Manual journal entries are not enabled in this database yet',
        503,
        'Missing table: clothing_accounting_journal_lines. Create/apply the required schema to enable manual entries.'
      );
    }
    throw error;
  }

  return ApiResponse.success(
    {
      entry: {
        sourceId,
        date: entryDate.toISOString(),
        ref,
        amount,
        debitAccount,
        creditAccount,
        description: description || '',
      },
    },
    'Manual journal entry updated'
  );
});

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const sourceId = req.nextUrl.searchParams.get('sourceId')?.trim();
  if (!sourceId) {
    return ApiResponse.badRequest('sourceId is required.');
  }

  try {
    const result = await prisma.clothingAccountingJournalLine.deleteMany({
      where: {
        sourceType: 'MANUAL',
        sourceId,
        systemGenerated: false,
      },
    });

    if (!result.count) {
      return ApiResponse.notFound('Manual journal entry');
    }
  } catch (error) {
    if (isMissingTableError(error)) {
      return ApiResponse.error(
        'Manual journal entries are not enabled in this database yet',
        503,
        'Missing table: clothing_accounting_journal_lines. Create/apply the required schema to enable manual entries.'
      );
    }
    throw error;
  }

  return ApiResponse.success({ sourceId }, 'Manual journal entry deleted');
});
