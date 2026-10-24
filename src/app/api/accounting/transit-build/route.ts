import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { parseDate } from '@/lib/accounting/date-utils';
import { getRuntimeAccountingCutoverDate } from '@/lib/accounting/cutover';
import { prisma } from '@/lib/db';
import { sanitizers } from '@/lib/security/sanitize';
import { hasSupplierSettlementForTransitKeys } from '@/lib/accounting/supplier-settlement-dependencies';

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

export const PATCH = withErrorHandler(async (request: NextRequest) =>
  prisma.$transaction(
    async (tx) => {
      const accountingCutover = await getRuntimeAccountingCutoverDate();
      const body = (await request
        .json()
        .catch(() => null)) as TransitBuildPatchRequestBody | null;

      const entryId = (body?.entryId ?? '').trim();
      if (!entryId) {
        return ApiResponse.badRequest('Missing entryId', {
          entryId: 'Provide the transit build-up entry id to update.',
        });
      }

      const existing = await tx.clothingInventoryTransitBuildEntry.findFirst({
        where: {
          id: entryId,
          deletedAt: null,
        },
        select: { id: true, shipmentCode: true, idempotencyKey: true },
      });

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
            postingDate:
              'Provide a valid date string (YYYY-MM-DD recommended).',
          });
        }

        if (postingDate < accountingCutover) {
          return ApiResponse.badRequest('Posting date is before cutover', {
            postingDate: `Posting date must be on or after ${accountingCutover.toISOString().slice(0, 10)}. Use opening balances for pre-cutover values.`,
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

      if (
        (next.amount !== undefined ||
          next.creditAccount !== undefined ||
          next.postingDate !== undefined) &&
        ((await tx.clothingInventoryReclassEntry.count({
          where: { shipmentCode: existing.shipmentCode, deletedAt: null },
        })) > 0 ||
          (await hasSupplierSettlementForTransitKeys(tx, [
            existing.idempotencyKey,
          ])))
      ) {
        return ApiResponse.conflict(
          'Transit build-up has downstream reclassification or supplier settlement entries. Reverse those entries before changing its source.'
        );
      }

      const updated = await tx.clothingInventoryTransitBuildEntry.update({
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
      });

      return ApiResponse.success(
        {
          entry: {
            id: updated.id,
            postingDate: updated.postingDate.toISOString(),
            amount: updated.amount,
            debitAccount: updated.debitAccount,
            creditAccount: updated.creditAccount,
            idempotencyKey: updated.idempotencyKey,
            notes: updated.notes,
            shipmentId: updated.shipmentId,
            shipmentCode: updated.shipmentCode,
          },
        },
        'Transit build-up entry updated'
      );
    },
    { isolationLevel: 'Serializable' }
  )
);

export const DELETE = withErrorHandler(async (request: NextRequest) =>
  prisma.$transaction(
    async (tx) => {
      const entryId = (
        request.nextUrl.searchParams.get('entryId') ?? ''
      ).trim();
      if (!entryId) {
        return ApiResponse.badRequest('Missing entryId', {
          entryId: 'Provide the transit build-up entry id to delete.',
        });
      }

      const existing = await tx.clothingInventoryTransitBuildEntry.findFirst({
        where: {
          id: entryId,
          deletedAt: null,
        },
        select: {
          id: true,
          idempotencyKey: true,
          shipmentCode: true,
        },
      });

      if (!existing) {
        return ApiResponse.notFound('Transit build-up entry');
      }

      if (
        (await tx.clothingInventoryReclassEntry.count({
          where: { shipmentCode: existing.shipmentCode, deletedAt: null },
        })) > 0 ||
        (await hasSupplierSettlementForTransitKeys(tx, [
          existing.idempotencyKey,
        ]))
      ) {
        return ApiResponse.conflict(
          'Transit build-up has downstream reclassification or supplier settlement entries. Reverse those entries before deleting its source.'
        );
      }

      const deletedAt = new Date();

      await tx.clothingInventoryTransitBuildEntry.update({
        where: { id: existing.id },
        data: { deletedAt },
      });

      return ApiResponse.success(
        {
          entryId: existing.id,
          idempotencyKey: existing.idempotencyKey,
          deletedAt: deletedAt.toISOString(),
        },
        'Transit build-up entry deleted'
      );
    },
    { isolationLevel: 'Serializable' }
  )
);
