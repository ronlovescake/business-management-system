import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { parseDate } from '@/lib/accounting/date-utils';
import { prisma } from '@/lib/db';
import { sanitizers } from '@/lib/security/sanitize';

const ACCOUNTING_CUTOVER = new Date(Date.UTC(2026, 0, 1));

const ALLOWED_CREDIT_ACCOUNTS = new Set(['Cash', 'Accounts Payable']);

type RouteContext = { params: { id: string } };

type TransitBuildRequestBody = {
  postingDate?: string | null;
  creditAccount?: string | null;
  notes?: string | null;
};

export const POST = withErrorHandler<RouteContext>(
  async (request: NextRequest, context) => {
    const idResult = parseShipmentId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const body = (await request
      .json()
      .catch(() => null)) as TransitBuildRequestBody | null;

    const creditAccountRaw = (body?.creditAccount ?? '').trim();
    if (!ALLOWED_CREDIT_ACCOUNTS.has(creditAccountRaw)) {
      return ApiResponse.badRequest('Invalid credit account', {
        creditAccount: `Allowed values: ${Array.from(
          ALLOWED_CREDIT_ACCOUNTS
        ).join(', ')}`,
      });
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

    const shipment = await prisma.shipment.findUnique({
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

    const products = await prisma.product.findMany({
      where: {
        shipmentCode,
        deletedAt: null,
      },
      select: {
        cogs: true,
      },
    });

    const amount = products.reduce((sum, product) => {
      const value = Number(product.cogs ?? 0);
      if (!Number.isFinite(value) || value <= 0) {
        return sum;
      }
      return sum + value;
    }, 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      return ApiResponse.badRequest('No valued products found for shipment', {
        shipmentCode:
          'Ensure Products linked to this Shipment Code have valid COGS values.',
      });
    }

    const debitAccount = 'Inventory in Transit';
    const creditAccount = creditAccountRaw;
    const idempotencyKey = `SHIPMENT_TRANSIT_BUILD:${shipmentCode}:${creditAccount}`;

    try {
      const entry = await prisma.clothingInventoryTransitBuildEntry.create({
        data: {
          postingDate,
          shipmentId: shipment.id,
          shipmentCode,
          amount,
          debitAccount,
          creditAccount,
          idempotencyKey,
          notes: body?.notes ? sanitizers.notes(body.notes) : null,
        },
      });

      return ApiResponse.success(
        {
          id: entry.id,
          shipmentId: shipment.id,
          shipmentCode,
          postingDate: entry.postingDate.toISOString(),
          amount: entry.amount,
          debitAccount,
          creditAccount,
          wasDuplicate: false,
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
        const existing =
          await prisma.clothingInventoryTransitBuildEntry.findUnique({
            where: { idempotencyKey },
          });

        return ApiResponse.success(
          {
            id: existing?.id ?? null,
            shipmentId: shipment.id,
            shipmentCode,
            postingDate: existing?.postingDate?.toISOString() ?? null,
            amount: existing?.amount ?? amount,
            debitAccount,
            creditAccount,
            wasDuplicate: true,
          },
          'Transit build-up entry already exists'
        );
      }

      throw error;
    }
  }
);

function parseShipmentId(
  context?: RouteContext
): { id: number } | { error: ReturnType<typeof ApiResponse.badRequest> } {
  const idParam = context?.params?.id ?? '';
  const id = Number(idParam);

  if (!idParam || Number.isNaN(id)) {
    return {
      error: ApiResponse.badRequest('Invalid shipment ID', {
        id: 'Provide a numeric shipment ID in the URL path.',
      }),
    };
  }

  return { id };
}
