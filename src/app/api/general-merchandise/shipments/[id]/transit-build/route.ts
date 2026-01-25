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

const ALLOWED_PAID_ACCOUNTS = new Set(['Cash', 'E-Wallet']);

const toCents = (value: number) => Math.round(value * 100);

type RouteContext = { params: { id: string } };

type TransitBuildRequestBody = {
  postingDate?: string | null;
  creditAccount?: string | null;
  paidAccount?: string | null;
  paidAmount?: number | null;
  forwarderEstimate?: number | null;
  courierEstimate?: number | null;
  notes?: string | null;
};

const gmPrisma = prisma as unknown as {
  generalMerchandiseShipment: typeof prisma.shipment;
  generalMerchandiseProduct: typeof prisma.product;
  generalMerchandiseInventoryTransitBuildEntry: typeof prisma.clothingInventoryTransitBuildEntry;
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

    const shipment = await gmPrisma.generalMerchandiseShipment.findUnique({
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

    const products = await gmPrisma.generalMerchandiseProduct.findMany({
      where: {
        shipmentCode,
        deletedAt: null,
      },
      select: {
        cogs: true,
      },
    });

    if (products.length === 0) {
      return ApiResponse.badRequest('No products linked to shipment code', {
        shipmentCode:
          'Link at least one Product to this Shipment Code on the Products page before creating a transit build-up entry.',
      });
    }

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

    const existingBuildEntries =
      await gmPrisma.generalMerchandiseInventoryTransitBuildEntry.findMany({
        where: {
          shipmentCode,
          deletedAt: null,
        },
        select: { idempotencyKey: true },
      });
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
        const entry =
          await gmPrisma.generalMerchandiseInventoryTransitBuildEntry.create({
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
            postingDate: entry.postingDate.toISOString(),
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
          const existing =
            await gmPrisma.generalMerchandiseInventoryTransitBuildEntry.findUnique(
              {
                where: { idempotencyKey },
              }
            );

          return ApiResponse.success(
            {
              shipmentId: shipment.id,
              shipmentCode,
              postingDate: existing?.postingDate?.toISOString() ?? null,
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

    const paidAmount = Number(body?.paidAmount ?? 0);
    const forwarderEstimate = Number(body?.forwarderEstimate ?? 0);
    const courierEstimate = Number(body?.courierEstimate ?? 0);

    if (
      !Number.isFinite(paidAmount) ||
      !Number.isFinite(forwarderEstimate) ||
      !Number.isFinite(courierEstimate)
    ) {
      return ApiResponse.badRequest('Invalid split amounts', {
        paidAmount:
          'Provide numeric amounts for paid, forwarder estimate, and courier estimate.',
      });
    }

    if (paidAmount < 0 || forwarderEstimate < 0 || courierEstimate < 0) {
      return ApiResponse.badRequest('Invalid split amounts', {
        paidAmount: 'Amounts must be 0 or greater.',
      });
    }

    const expectedTotalCents = toCents(amount);
    const splitTotalCents =
      toCents(paidAmount) +
      toCents(forwarderEstimate) +
      toCents(courierEstimate);

    if (expectedTotalCents !== splitTotalCents) {
      return ApiResponse.badRequest('Split amounts do not match total', {
        paidAmount:
          'Paid + Forwarder Estimate + Courier Estimate must equal total COGS amount.',
        expectedTotalAmount: String(amount),
        actualTotalAmount: String(
          paidAmount + forwarderEstimate + courierEstimate
        ),
      });
    }

    const paidAccount = paidAccountRaw;

    const entriesToCreate = [
      {
        amount: paidAmount,
        creditAccount: paidAccount,
        idempotencyKey: `SHIPMENT_TRANSIT_BUILD:${shipmentCode}:SPLIT:${paidAccount}`,
      },
      {
        amount: forwarderEstimate,
        creditAccount: 'Forwarder Payable',
        idempotencyKey: `SHIPMENT_TRANSIT_BUILD:${shipmentCode}:SPLIT:FORWARDER`,
      },
      {
        amount: courierEstimate,
        creditAccount: 'Courier Payable',
        idempotencyKey: `SHIPMENT_TRANSIT_BUILD:${shipmentCode}:SPLIT:COURIER`,
      },
    ].filter((entry) => entry.amount > 0);

    const createdEntries = [] as Array<{
      id: string | null;
      amount: number;
      debitAccount: string;
      creditAccount: string;
      idempotencyKey: string;
      wasDuplicate: boolean;
    }>;

    for (const entry of entriesToCreate) {
      try {
        const created =
          await gmPrisma.generalMerchandiseInventoryTransitBuildEntry.create({
            data: {
              postingDate,
              shipmentId: shipment.id,
              shipmentCode,
              amount: entry.amount,
              debitAccount,
              creditAccount: entry.creditAccount,
              idempotencyKey: entry.idempotencyKey,
              notes: sanitizedNotes,
            },
          });

        createdEntries.push({
          id: created.id,
          amount: created.amount,
          debitAccount,
          creditAccount: created.creditAccount,
          idempotencyKey: created.idempotencyKey,
          wasDuplicate: false,
        });
      } catch (error) {
        const isDuplicate =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code?: unknown }).code === 'P2002';

        if (isDuplicate) {
          const existing =
            await gmPrisma.generalMerchandiseInventoryTransitBuildEntry.findUnique(
              {
                where: { idempotencyKey: entry.idempotencyKey },
              }
            );

          createdEntries.push({
            id: existing?.id ?? null,
            amount: existing?.amount ?? entry.amount,
            debitAccount,
            creditAccount: existing?.creditAccount ?? entry.creditAccount,
            idempotencyKey: entry.idempotencyKey,
            wasDuplicate: true,
          });
          continue;
        }

        throw error;
      }
    }

    const totalAmount = createdEntries.reduce(
      (sum, entry) => sum + entry.amount,
      0
    );

    return ApiResponse.success(
      {
        shipmentId: shipment.id,
        shipmentCode,
        postingDate: createdEntries[0]?.id ? postingDate.toISOString() : null,
        totalAmount,
        expectedTotalAmount: amount,
        wasDuplicate: createdEntries.every((entry) => entry.wasDuplicate),
        entries: createdEntries,
      },
      'Transit build-up entries created'
    );
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
