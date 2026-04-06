import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { parseDate } from '@/lib/accounting/date-utils';
import { sanitizers } from '@/lib/security/sanitize';
import { parseShipmentId, computeExpectedAmount } from './shipmentUtils';

const ACCOUNTING_CUTOVER = new Date(Date.UTC(2026, 0, 1));

const ALLOWED_CREDIT_ACCOUNTS = new Set([
  'Cash',
  'Bank',
  'E-Wallet',
  'Accounts Payable',
  'Forwarder Payable',
  'Courier Payable',
]);

const ALLOWED_PAID_ACCOUNTS = new Set(['Cash', 'E-Wallet']);

const toCents = (value: number) => Math.round(value * 100);

type RouteContext = { params: { id: string } };

type TransitBuildRequestBody = {
  postingDate?: string | null;
  creditAccount?: string | null;
  paidAccount?: string | null;
  paidAmount?: number | null;
  supplierEstimate?: number | null;
  forwarderEstimate?: number | null;
  courierEstimate?: number | null;
  notes?: string | null;
};

type TransitBuildPatchRequestBody = {
  entryId?: string | null;
  postingDate?: string | null;
  amount?: number | null;
  creditAccount?: string | null;
  notes?: string | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface TransitBuildDelegates {
  shipmentModel: {
    findUnique: (args: any) => Promise<{
      id: number;
      shipmentCode: string | null;
    } | null>;
  };
  productModel: {
    findMany: (args: any) => Promise<
      Array<{
        cogs: unknown;
        grandTotal: unknown;
        forwardersFee: unknown;
        lalamove: unknown;
        packagingCost: unknown;
      }>
    >;
  };
  transitBuildModel: {
    findMany: (args: any) => Promise<Array<any>>;
    findFirst: (args: any) => Promise<any>;
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    upsert: (args: any) => Promise<any>;
  };
  /** Prisma $transaction for split mode. */
  $transaction: (operations: Array<any>) => Promise<Array<any>>;
  /** Optional pre-check (GM uses table-existence check). */
  preCheck?: () => Promise<
    | { ok: true }
    | { ok: false; response: ReturnType<typeof ApiResponse.badRequest> }
  >;
}

export function createTransitBuildRoutes(delegates: TransitBuildDelegates) {
  const GET = withErrorHandler<RouteContext>(
    async (_request: NextRequest, context) => {
      const idResult = parseShipmentId(context);
      if ('error' in idResult) {
        return idResult.error;
      }

      if (delegates.preCheck) {
        const check = await delegates.preCheck();
        if (!check.ok) {
          return check.response;
        }
      }

      const shipment = await delegates.shipmentModel.findUnique({
        where: { id: idResult.id },
        select: { id: true, shipmentCode: true },
      });

      if (!shipment) {
        return ApiResponse.notFound('Shipment');
      }

      const shipmentCode = (shipment.shipmentCode ?? '').trim();
      if (!shipmentCode) {
        return ApiResponse.badRequest('Shipment has no shipment code', {
          shipmentCode:
            'Add a Shipment Code before querying transit build-up entries.',
        });
      }

      const buildEntries = (await delegates.transitBuildModel.findMany({
        where: { shipmentCode, deletedAt: null },
        orderBy: [{ postingDate: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          postingDate: true,
          amount: true,
          debitAccount: true,
          creditAccount: true,
          idempotencyKey: true,
          notes: true,
        },
      })) as Array<{
        id: string;
        postingDate: Date;
        amount: number;
        debitAccount: string;
        creditAccount: string;
        idempotencyKey: string;
        notes: string | null;
      }>;

      const products = await delegates.productModel.findMany({
        where: { shipmentCode, deletedAt: null },
        select: {
          cogs: true,
          grandTotal: true,
          forwardersFee: true,
          lalamove: true,
          packagingCost: true,
        },
      });

      const expectedTotalAmount = computeExpectedAmount(products);

      return ApiResponse.success(
        {
          shipmentId: shipment.id,
          shipmentCode,
          expectedTotalAmount,
          totalAmount: buildEntries.reduce(
            (sum, row) => sum + Number(row.amount ?? 0),
            0
          ),
          entries: buildEntries.map((row) => ({
            id: row.id,
            postingDate: row.postingDate.toISOString(),
            amount: row.amount,
            debitAccount: row.debitAccount,
            creditAccount: row.creditAccount,
            idempotencyKey: row.idempotencyKey,
            notes: row.notes,
          })),
        },
        'Transit build-up entries fetched'
      );
    }
  );

  const POST = withErrorHandler<RouteContext>(
    async (request: NextRequest, context) => {
      const idResult = parseShipmentId(context);
      if ('error' in idResult) {
        return idResult.error;
      }

      if (delegates.preCheck) {
        const check = await delegates.preCheck();
        if (!check.ok) {
          return check.response;
        }
      }

      const body = (await request
        .json()
        .catch(() => null)) as TransitBuildRequestBody | null;

      const paidAccountRaw = (body?.paidAccount ?? '').trim();
      const isSplitMode = paidAccountRaw.length > 0;

      const creditAccountRaw = (body?.creditAccount ?? '').trim();
      if (!isSplitMode) {
        if (!ALLOWED_CREDIT_ACCOUNTS.has(creditAccountRaw)) {
          return ApiResponse.badRequest('Invalid credit account', {
            creditAccount: `Allowed values: ${Array.from(
              ALLOWED_CREDIT_ACCOUNTS
            ).join(', ')}`,
          });
        }
      } else {
        if (!ALLOWED_PAID_ACCOUNTS.has(paidAccountRaw)) {
          return ApiResponse.badRequest('Invalid paid account', {
            paidAccount: `Allowed values: ${Array.from(ALLOWED_PAID_ACCOUNTS).join(', ')}`,
          });
        }
      }

      const postingDate = parseDate(body?.postingDate) ?? new Date();
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

      const shipment = await delegates.shipmentModel.findUnique({
        where: { id: idResult.id },
        select: { id: true, shipmentCode: true },
      });

      if (!shipment) {
        return ApiResponse.notFound('Shipment');
      }

      const shipmentCode = (shipment.shipmentCode ?? '').trim();
      if (!shipmentCode) {
        return ApiResponse.badRequest('Shipment has no shipment code', {
          shipmentCode: 'Add a Shipment Code before creating a transit entry.',
        });
      }

      const products = await delegates.productModel.findMany({
        where: { shipmentCode, deletedAt: null },
        select: {
          cogs: true,
          grandTotal: true,
          forwardersFee: true,
          lalamove: true,
          packagingCost: true,
        },
      });

      if (products.length === 0) {
        return ApiResponse.badRequest('No products linked to shipment code', {
          shipmentCode:
            'Link at least one Product to this Shipment Code on the Products page before creating a transit build-up entry.',
        });
      }

      const amount = computeExpectedAmount(products);

      if (!Number.isFinite(amount) || amount <= 0) {
        return ApiResponse.badRequest('No valued products found for shipment', {
          shipmentCode:
            "Ensure Products linked to this Shipment Code have valid cost values (COGS, or Grand Total + Forwarder's Fee + Lalamove + Packaging Cost).",
        });
      }

      const debitAccount = 'Inventory in Transit';

      // Prevent accidentally mixing old single-entry mode with new split mode.
      const existingBuildEntries = (await delegates.transitBuildModel.findMany({
        where: { shipmentCode, deletedAt: null },
        select: { idempotencyKey: true },
      })) as Array<{ idempotencyKey: string }>;

      const hasAnyExisting = existingBuildEntries.length > 0;
      const isLegacyOnly = existingBuildEntries.some(
        (row) =>
          row.idempotencyKey.startsWith(
            `SHIPMENT_TRANSIT_BUILD:${shipmentCode}:`
          ) && !row.idempotencyKey.includes(':SPLIT:')
      );
      const isSplitOnly = existingBuildEntries.some((row) =>
        row.idempotencyKey.includes(
          `SHIPMENT_TRANSIT_BUILD:${shipmentCode}:SPLIT:`
        )
      );
      if (hasAnyExisting && isLegacyOnly && isSplitMode && !isSplitOnly) {
        return ApiResponse.badRequest('Transit build-up already exists', {
          shipmentCode:
            'This shipment already has a transit build-up entry created using the old single-account mode. Delete/void it before using split mode for this shipment.',
        });
      }

      const sanitizedNotes = body?.notes ? sanitizers.notes(body.notes) : null;

      if (!isSplitMode) {
        const creditAccount = creditAccountRaw;
        const idempotencyKey = `SHIPMENT_TRANSIT_BUILD:${shipmentCode}:${creditAccount}`;

        try {
          const entry = await delegates.transitBuildModel.create({
            data: {
              postingDate,
              shipmentId: shipment.id,
              shipmentCode,
              amount,
              debitAccount,
              creditAccount,
              idempotencyKey,
              notes: sanitizedNotes,
            },
          });

          return ApiResponse.success(
            {
              shipmentId: shipment.id,
              shipmentCode,
              postingDate: (entry.postingDate as Date).toISOString(),
              totalAmount: entry.amount,
              expectedTotalAmount: amount,
              wasDuplicate: false,
              entries: [
                {
                  id: entry.id,
                  amount: entry.amount,
                  debitAccount,
                  creditAccount,
                  idempotencyKey,
                  wasDuplicate: false,
                },
              ],
            },
            'Transit build-up entry created'
          );
        } catch (error) {
          const isDuplicate =
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code?: unknown }).code === 'P2002';

          if (isDuplicate) {
            const existing = await delegates.transitBuildModel.findUnique({
              where: { idempotencyKey },
            });

            return ApiResponse.success(
              {
                shipmentId: shipment.id,
                shipmentCode,
                postingDate:
                  (existing?.postingDate as Date | undefined)?.toISOString() ??
                  null,
                totalAmount: existing?.amount ?? amount,
                expectedTotalAmount: amount,
                wasDuplicate: true,
                entries: [
                  {
                    id: existing?.id ?? null,
                    amount: existing?.amount ?? amount,
                    debitAccount,
                    creditAccount,
                    idempotencyKey,
                    wasDuplicate: true,
                  },
                ],
              },
              'Transit build-up entry already exists'
            );
          }

          throw error;
        }
      }

      // Split mode
      const paidAmount = Number(body?.paidAmount ?? 0);
      const supplierEstimate = Number(body?.supplierEstimate ?? 0);
      const forwarderEstimate = Number(body?.forwarderEstimate ?? 0);
      const courierEstimate = Number(body?.courierEstimate ?? 0);

      if (
        !Number.isFinite(paidAmount) ||
        !Number.isFinite(supplierEstimate) ||
        !Number.isFinite(forwarderEstimate) ||
        !Number.isFinite(courierEstimate)
      ) {
        return ApiResponse.badRequest('Invalid split amounts', {
          paidAmount:
            'Provide numeric amounts for paid, supplier estimate, forwarder estimate, and courier estimate.',
        });
      }

      if (
        paidAmount < 0 ||
        supplierEstimate < 0 ||
        forwarderEstimate < 0 ||
        courierEstimate < 0
      ) {
        return ApiResponse.badRequest('Invalid split amounts', {
          paidAmount: 'Amounts must be 0 or greater.',
        });
      }

      const expectedTotalCents = toCents(amount);
      const splitTotalCents =
        toCents(paidAmount) +
        toCents(supplierEstimate) +
        toCents(forwarderEstimate) +
        toCents(courierEstimate);

      if (splitTotalCents !== expectedTotalCents) {
        return ApiResponse.badRequest(
          'Split amounts do not match shipment total',
          {
            expectedTotalAmount: `₱${amount.toFixed(2)} (sum of linked Product COGS)`,
            providedTotalAmount: `₱${(splitTotalCents / 100).toFixed(2)}`,
            splitBreakdown: `Paid ₱${paidAmount.toFixed(2)} + Supplier ₱${supplierEstimate.toFixed(2)} + Forwarder ₱${forwarderEstimate.toFixed(2)} + Courier ₱${courierEstimate.toFixed(2)}`,
          }
        );
      }

      const parts: Array<{
        key: string;
        creditAccount: string;
        partAmount: number;
      }> = [];
      if (paidAmount > 0) {
        parts.push({
          key: `SHIPMENT_TRANSIT_BUILD:${shipmentCode}:SPLIT:PAID`,
          creditAccount: paidAccountRaw,
          partAmount: paidAmount,
        });
      }
      if (supplierEstimate > 0) {
        parts.push({
          key: `SHIPMENT_TRANSIT_BUILD:${shipmentCode}:SPLIT:SUPPLIER_PAYABLE`,
          creditAccount: 'Accounts Payable',
          partAmount: supplierEstimate,
        });
      }
      if (forwarderEstimate > 0) {
        parts.push({
          key: `SHIPMENT_TRANSIT_BUILD:${shipmentCode}:SPLIT:FORWARDER_PAYABLE`,
          creditAccount: 'Forwarder Payable',
          partAmount: forwarderEstimate,
        });
      }
      if (courierEstimate > 0) {
        parts.push({
          key: `SHIPMENT_TRANSIT_BUILD:${shipmentCode}:SPLIT:COURIER_PAYABLE`,
          creditAccount: 'Courier Payable',
          partAmount: courierEstimate,
        });
      }

      const partKeys = parts.map((part) => part.key);
      const existingParts = (await delegates.transitBuildModel.findMany({
        where: { idempotencyKey: { in: partKeys }, deletedAt: null },
        select: { idempotencyKey: true },
      })) as Array<{ idempotencyKey: string }>;
      const existingKeySet = new Set(
        existingParts.map((row) => row.idempotencyKey)
      );

      const entries = (await delegates.$transaction(
        parts.map(
          (part) =>
            delegates.transitBuildModel.upsert({
              where: { idempotencyKey: part.key },
              update: {
                postingDate,
                shipmentId: shipment.id,
                shipmentCode,
                amount: part.partAmount,
                debitAccount,
                creditAccount: part.creditAccount,
                notes: sanitizedNotes,
                deletedAt: null,
              },
              create: {
                postingDate,
                shipmentId: shipment.id,
                shipmentCode,
                amount: part.partAmount,
                debitAccount,
                creditAccount: part.creditAccount,
                idempotencyKey: part.key,
                notes: sanitizedNotes,
              },
            }) as Promise<unknown>
        )
      )) as Array<{
        id: string;
        amount: number;
        creditAccount: string;
        idempotencyKey: string;
      }>;

      const results = entries.map((entry) => ({
        id: entry.id,
        amount: entry.amount,
        debitAccount,
        creditAccount: entry.creditAccount,
        idempotencyKey: entry.idempotencyKey,
        wasDuplicate: existingKeySet.has(entry.idempotencyKey),
      }));

      return ApiResponse.success(
        {
          shipmentId: shipment.id,
          shipmentCode,
          postingDate: postingDate.toISOString(),
          totalAmount: results.reduce(
            (sum, row) => sum + Number(row.amount ?? 0),
            0
          ),
          expectedTotalAmount: amount,
          wasDuplicate: results.every((row) => row.wasDuplicate),
          entries: results,
        },
        results.every((row) => row.wasDuplicate)
          ? 'Transit build-up entries updated'
          : 'Transit build-up entries created'
      );
    }
  );

  const PATCH = withErrorHandler<RouteContext>(
    async (request: NextRequest, context) => {
      const idResult = parseShipmentId(context);
      if ('error' in idResult) {
        return idResult.error;
      }

      if (delegates.preCheck) {
        const check = await delegates.preCheck();
        if (!check.ok) {
          return check.response;
        }
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

      const shipment = await delegates.shipmentModel.findUnique({
        where: { id: idResult.id },
        select: { id: true, shipmentCode: true },
      });

      if (!shipment) {
        return ApiResponse.notFound('Shipment');
      }

      const shipmentCode = (shipment.shipmentCode ?? '').trim();
      if (!shipmentCode) {
        return ApiResponse.badRequest('Shipment has no shipment code', {
          shipmentCode: 'Add a Shipment Code before updating a transit entry.',
        });
      }

      const existing = await delegates.transitBuildModel.findFirst({
        where: { id: entryId, shipmentCode, deletedAt: null },
        select: { id: true, idempotencyKey: true, debitAccount: true },
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

        if (postingDate < ACCOUNTING_CUTOVER) {
          return ApiResponse.badRequest('Posting date is before cutover', {
            postingDate: `Posting date must be on or after ${ACCOUNTING_CUTOVER.toISOString().slice(0, 10)}. Use opening balances for pre-cutover values.`,
          });
        }

        next.postingDate = postingDate;
      }

      if (body?.amount !== null && body?.amount !== undefined) {
        const entryAmount = Number(body.amount);
        if (!Number.isFinite(entryAmount) || entryAmount < 0) {
          return ApiResponse.badRequest('Invalid amount', {
            amount: 'Provide a numeric amount that is 0 or greater.',
          });
        }

        next.amount = entryAmount;
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

      const updated = (await delegates.transitBuildModel.update({
        where: { id: existing.id },
        data: { ...next, deletedAt: null },
        select: {
          id: true,
          postingDate: true,
          amount: true,
          debitAccount: true,
          creditAccount: true,
          idempotencyKey: true,
          notes: true,
        },
      })) as {
        id: string;
        postingDate: Date;
        amount: number;
        debitAccount: string;
        creditAccount: string;
        idempotencyKey: string;
        notes: string | null;
      };

      return ApiResponse.success(
        {
          shipmentId: shipment.id,
          shipmentCode,
          entry: {
            id: updated.id,
            postingDate: updated.postingDate.toISOString(),
            amount: updated.amount,
            debitAccount: updated.debitAccount,
            creditAccount: updated.creditAccount,
            idempotencyKey: updated.idempotencyKey,
            notes: updated.notes,
          },
        },
        'Transit build-up entry updated'
      );
    }
  );

  const DELETE = withErrorHandler<RouteContext>(
    async (request: NextRequest, context) => {
      const idResult = parseShipmentId(context);
      if ('error' in idResult) {
        return idResult.error;
      }

      if (delegates.preCheck) {
        const check = await delegates.preCheck();
        if (!check.ok) {
          return check.response;
        }
      }

      const entryId = (
        request.nextUrl.searchParams.get('entryId') ?? ''
      ).trim();
      if (!entryId) {
        return ApiResponse.badRequest('Missing entryId', {
          entryId: 'Provide the transit build-up entry id to delete.',
        });
      }

      const shipment = await delegates.shipmentModel.findUnique({
        where: { id: idResult.id },
        select: { id: true, shipmentCode: true },
      });

      if (!shipment) {
        return ApiResponse.notFound('Shipment');
      }

      const shipmentCode = (shipment.shipmentCode ?? '').trim();
      if (!shipmentCode) {
        return ApiResponse.badRequest('Shipment has no shipment code', {
          shipmentCode: 'Add a Shipment Code before deleting a transit entry.',
        });
      }

      const existing = (await delegates.transitBuildModel.findFirst({
        where: { id: entryId, shipmentCode, deletedAt: null },
        select: { id: true, idempotencyKey: true },
      })) as { id: string; idempotencyKey: string } | null;

      if (!existing) {
        return ApiResponse.notFound('Transit build-up entry');
      }

      const deletedAt = new Date();

      await delegates.transitBuildModel.update({
        where: { id: existing.id },
        data: { deletedAt },
      });

      return ApiResponse.success(
        {
          shipmentId: shipment.id,
          shipmentCode,
          entryId: existing.id,
          idempotencyKey: existing.idempotencyKey,
          deletedAt: deletedAt.toISOString(),
        },
        'Transit build-up entry deleted'
      );
    }
  );

  return { GET, POST, PATCH, DELETE };
}
