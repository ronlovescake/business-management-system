import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { parseDate } from '@/lib/accounting/date-utils';
import { prisma } from '@/lib/db';
import { sanitizers } from '@/lib/security/sanitize';

const ACCOUNTING_CUTOVER = new Date(Date.UTC(2026, 0, 1));

const ALLOWED_CREDIT_ACCOUNTS = new Set([
  'Cash',
  'Bank',
  'E-Wallet',
  'Accounts Payable',
  'Forwarder Payable',
  'Courier Payable',
]);

type TransitBuildPatchRequestBody = {
  entryId?: string | null;
  postingDate?: string | null;
  amount?: number | null;
  creditAccount?: string | null;
  notes?: string | null;
};

type GMTransitBuildModel = {
  findFirst: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
};

const getTransitBuildModel = (): GMTransitBuildModel | null => {
  const candidate = Reflect.get(
    prisma,
    'generalMerchandiseInventoryTransitBuildEntry'
  );

  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const findFirst = Reflect.get(candidate, 'findFirst');
  const update = Reflect.get(candidate, 'update');

  if (typeof findFirst !== 'function' || typeof update !== 'function') {
    return null;
  }

  return {
    findFirst: (args: unknown) =>
      (findFirst as (args: unknown) => Promise<unknown>).call(candidate, args),
    update: (args: unknown) =>
      (update as (args: unknown) => Promise<unknown>).call(candidate, args),
  };
};

export const PATCH = withErrorHandler(async (request: NextRequest) => {
  const transitBuildModel = getTransitBuildModel();
  if (!transitBuildModel) {
    return ApiResponse.badRequest('Transit build-up not available for GM');
  }

  const body = (await request
    .json()
    .catch(() => null)) as TransitBuildPatchRequestBody | null;

  const entryId = (body?.entryId ?? '').trim();
  if (!entryId) {
    return ApiResponse.badRequest('Missing entryId', {
      entryId: 'Provide the transit build-up entry id to update.',
    });
  }

  const existing = (await transitBuildModel.findFirst({
    where: {
      id: entryId,
      deletedAt: null,
    },
    select: { id: true },
  })) as { id: string } | null;

  if (!existing) {
    return ApiResponse.notFound('Transit build-up entry');
  }

  const next: {
    postingDate?: Date;
    amount?: number;
    creditAccount?: string;
    notes?: string | null;
  } = {};

  if (body?.postingDate !== null && body?.postingDate !== undefined) {
    const postingDate = parseDate(body.postingDate) ?? new Date();
    if (Number.isNaN(postingDate.getTime())) {
      return ApiResponse.badRequest('Invalid posting date', {
        postingDate: 'Provide a valid date string (YYYY-MM-DD recommended).',
      });
    }

    if (postingDate < ACCOUNTING_CUTOVER) {
      return ApiResponse.badRequest('Posting date is before cutover', {
        postingDate: `Posting date must be on or after ${ACCOUNTING_CUTOVER.toISOString().slice(0, 10)}. Use opening balances for pre-cutover values.`,
      });
    }

    next.postingDate = postingDate;
  }

  if (body?.amount !== null && body?.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return ApiResponse.badRequest('Invalid amount', {
        amount: 'Provide a numeric amount that is 0 or greater.',
      });
    }

    next.amount = amount;
  }

  if (body?.creditAccount !== null && body?.creditAccount !== undefined) {
    const creditAccount = (body.creditAccount ?? '').trim();
    if (!ALLOWED_CREDIT_ACCOUNTS.has(creditAccount)) {
      return ApiResponse.badRequest('Invalid credit account', {
        creditAccount: `Allowed values: ${Array.from(ALLOWED_CREDIT_ACCOUNTS).join(', ')}`,
      });
    }

    next.creditAccount = creditAccount;
  }

  if ('notes' in (body ?? {})) {
    next.notes = body?.notes ? sanitizers.notes(body.notes) : null;
  }

  if (Object.keys(next).length === 0) {
    return ApiResponse.badRequest('No updates provided', {
      entryId: 'Provide at least one field to update.',
    });
  }

  const updated = (await transitBuildModel.update({
    where: { id: existing.id },
    data: {
      ...next,
      deletedAt: null,
    },
    select: {
      id: true,
      postingDate: true,
      amount: true,
      debitAccount: true,
      creditAccount: true,
      idempotencyKey: true,
      notes: true,
      shipmentId: true,
      shipmentCode: true,
    },
  })) as {
    id: string;
    postingDate: Date;
    amount: unknown;
    debitAccount: string;
    creditAccount: string;
    idempotencyKey?: string | null;
    notes?: unknown;
    shipmentId: number | null;
    shipmentCode: string | null;
  };

  return ApiResponse.success(
    {
      entry: {
        id: updated.id,
        postingDate: updated.postingDate.toISOString(),
        amount: Number(updated.amount ?? 0),
        debitAccount: updated.debitAccount,
        creditAccount: updated.creditAccount,
        idempotencyKey: updated.idempotencyKey ?? null,
        notes: updated.notes ?? null,
        shipmentId: updated.shipmentId,
        shipmentCode: updated.shipmentCode,
      },
    },
    'Transit build-up entry updated'
  );
});

export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const transitBuildModel = getTransitBuildModel();
  if (!transitBuildModel) {
    return ApiResponse.badRequest('Transit build-up not available for GM');
  }

  const entryId = (request.nextUrl.searchParams.get('entryId') ?? '').trim();
  if (!entryId) {
    return ApiResponse.badRequest('Missing entryId', {
      entryId: 'Provide the transit build-up entry id to delete.',
    });
  }

  const existing = (await transitBuildModel.findFirst({
    where: {
      id: entryId,
      deletedAt: null,
    },
    select: {
      id: true,
      idempotencyKey: true,
    },
  })) as { id: string; idempotencyKey?: string | null } | null;

  if (!existing) {
    return ApiResponse.notFound('Transit build-up entry');
  }

  const deletedAt = new Date();

  await transitBuildModel.update({
    where: { id: existing.id },
    data: { deletedAt },
  });

  return ApiResponse.success(
    {
      entryId: existing.id,
      idempotencyKey: existing.idempotencyKey ?? null,
      deletedAt: deletedAt.toISOString(),
    },
    'Transit build-up entry deleted'
  );
});
