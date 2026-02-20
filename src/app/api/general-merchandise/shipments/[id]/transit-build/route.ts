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
  supplierEstimate?: number | null;
  forwarderEstimate?: number | null;
  courierEstimate?: number | null;
  notes?: string | null;
};

type GMShipmentTransitBuildClient = Pick<
  typeof prisma,
  | 'generalMerchandiseShipment'
  | 'generalMerchandiseProduct'
  | 'generalMerchandiseInventoryTransitBuildEntry'
>;

const gmClient: GMShipmentTransitBuildClient = prisma;

async function hasGmTransitBuildTable(): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<
      Array<{ regclass: string | null }>
    >`SELECT to_regclass('general_merchandise.inventory_transit_build_entries')::text as regclass`;
    return Boolean(result?.[0]?.regclass);
  } catch (_error) {
    return false;
  }
}

export const GET = withErrorHandler<RouteContext>(
  async (_request: NextRequest, context) => {
    const idResult = parseShipmentId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const hasTable = await hasGmTransitBuildTable();
    if (!hasTable) {
      return ApiResponse.badRequest(
        'GM transit build-up table is not available',
        {
          table: 'general_merchandise.inventory_transit_build_entries',
        }
      );
    }

    const shipment = await gmClient.generalMerchandiseShipment.findUnique({
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

    const buildEntries =
      await gmClient.generalMerchandiseInventoryTransitBuildEntry.findMany({
        where: {
          shipmentCode,
          deletedAt: null,
        },
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
      });

    const products = await gmClient.generalMerchandiseProduct.findMany({
      where: {
        shipmentCode,
        deletedAt: null,
      },
      select: {
        cogs: true,
        grandTotal: true,
        forwardersFee: true,
        lalamove: true,
        packagingCost: true,
      },
    });

    const expectedTotalAmount = products.reduce((sum, product) => {
      const rawCogs = Number(product.cogs ?? 0);
      const derivedCogs =
        Number(product.grandTotal ?? 0) +
        Number(product.forwardersFee ?? 0) +
        Number(product.lalamove ?? 0) +
        Number(product.packagingCost ?? 0);

      const value = rawCogs > 0 ? rawCogs : derivedCogs;
      if (!Number.isFinite(value) || value <= 0) {
        return sum;
      }
      return sum + value;
    }, 0);

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

    const shipment = await gmClient.generalMerchandiseShipment.findUnique({
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

    const products = await gmClient.generalMerchandiseProduct.findMany({
      where: {
        shipmentCode,
        deletedAt: null,
      },
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

    const amount = products.reduce((sum, product) => {
      const rawCogs = Number(product.cogs ?? 0);
      const derivedCogs =
        Number(product.grandTotal ?? 0) +
        Number(product.forwardersFee ?? 0) +
        Number(product.lalamove ?? 0) +
        Number(product.packagingCost ?? 0);

      const value = rawCogs > 0 ? rawCogs : derivedCogs;
      if (!Number.isFinite(value) || value <= 0) {
        return sum;
      }
      return sum + value;
    }, 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      return ApiResponse.badRequest('No valued products found for shipment', {
        shipmentCode:
          "Ensure Products linked to this Shipment Code have valid cost values (COGS, or Grand Total + Forwarder's Fee + Lalamove + Packaging Cost).",
      });
    }

    const debitAccount = 'Inventory in Transit';

    if (!(await hasGmTransitBuildTable())) {
      return ApiResponse.badRequest('Transit build-up table missing', {
        shipmentCode:
          'Transit build-up entries are not available for General Merchandise yet. Please run the GM transit build-up migration before creating entries.',
      });
    }

    const existingBuildEntries =
      await gmClient.generalMerchandiseInventoryTransitBuildEntry.findMany({
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
          await gmClient.generalMerchandiseInventoryTransitBuildEntry.create({
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
            await gmClient.generalMerchandiseInventoryTransitBuildEntry.findUnique(
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

    if (expectedTotalCents !== splitTotalCents) {
      return ApiResponse.badRequest('Split amounts do not match total', {
        paidAmount:
          'Paid + Supplier + Forwarder + Courier must equal total COGS amount.',
        expectedTotalAmount: `₱${amount.toFixed(2)} (sum of linked Product COGS)`,
        providedTotalAmount: `₱${(splitTotalCents / 100).toFixed(2)}`,
        splitBreakdown: `Paid ₱${paidAmount.toFixed(2)} + Supplier ₱${supplierEstimate.toFixed(2)} + Forwarder ₱${forwarderEstimate.toFixed(2)} + Courier ₱${courierEstimate.toFixed(2)}`,
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
        amount: supplierEstimate,
        creditAccount: 'Accounts Payable',
        idempotencyKey: `SHIPMENT_TRANSIT_BUILD:${shipmentCode}:SPLIT:SUPPLIER_PAYABLE`,
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
          await gmClient.generalMerchandiseInventoryTransitBuildEntry.create({
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
            await gmClient.generalMerchandiseInventoryTransitBuildEntry.findUnique(
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
