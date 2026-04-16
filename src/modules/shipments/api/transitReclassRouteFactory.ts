import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { parseDate } from '@/lib/accounting/date-utils';
import { sanitizers } from '@/lib/security/sanitize';
import {
  parseShipmentId,
  computeExpectedAmount,
  getTransitBuildEntrySource,
  parseProductIdFromTransitBuildKey,
} from './shipmentUtils';

const ACCOUNTING_CUTOVER = new Date(Date.UTC(2026, 0, 1));

const IN_TRANSIT_ACCOUNT = 'Inventory in Transit';
const STOCK_ON_HAND_ACCOUNT = 'Stock on Hand';

const toCents = (value: number) => Math.round(value * 100);

type RouteContext = { params: { id: string } };

type TransitReclassRequestBody = {
  postingDate?: string | null;
  selectedIdempotencyKeys?: string[] | null;
  notes?: string | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface TransitReclassDelegates {
  shipmentModel: {
    findUnique: (args: any) => Promise<{
      id: number;
      shipmentCode: string | null;
      shipmentStatus: string | null;
    } | null>;
  };
  productModel: {
    findMany: (args: any) => Promise<
      Array<{
        id?: number;
        productCode?: string | null;
        cogs: unknown;
        grandTotal: unknown;
        forwardersFee: unknown;
        lalamove: unknown;
        packagingCost: unknown;
      }>
    >;
  };
  transitBuildModel: {
    findMany: (args: any) => Promise<
      Array<{
        id: string;
        idempotencyKey: string;
        amount: number;
      }>
    >;
  };
  reclassModel: {
    findMany: (args: any) => Promise<Array<{ productCode?: string | null }>>;
    createMany: (args: any) => Promise<unknown>;
  };
}

export function createTransitReclassRoutes(delegates: TransitReclassDelegates) {
  const POST = withErrorHandler<RouteContext>(
    async (request: NextRequest, context) => {
      const idResult = parseShipmentId(context);
      if ('error' in idResult) {
        return idResult.error;
      }

      const body = (await request
        .json()
        .catch(() => null)) as TransitReclassRequestBody | null;

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
        select: { id: true, shipmentCode: true, shipmentStatus: true },
      });

      if (!shipment) {
        return ApiResponse.notFound('Shipment');
      }

      const shipmentStatus = (shipment.shipmentStatus ?? '').trim();
      if (shipmentStatus.toLowerCase() !== 'delivered') {
        return ApiResponse.badRequest(
          'Shipment must be Delivered before reclassing',
          { shipmentStatus: shipmentStatus || '(blank)' }
        );
      }

      const shipmentCode = (shipment.shipmentCode ?? '').trim();
      if (!shipmentCode) {
        return ApiResponse.badRequest('Shipment has no shipment code', {
          shipmentCode: 'Add a Shipment Code before creating reclass entries.',
        });
      }

      const selectedKeysRaw = Array.isArray(body?.selectedIdempotencyKeys)
        ? body?.selectedIdempotencyKeys
        : [];
      const selectedKeys = selectedKeysRaw
        .map((key) => (key ?? '').trim())
        .filter(Boolean);

      const transitBuildEntries = await delegates.transitBuildModel.findMany({
        where: {
          shipmentCode,
          deletedAt: null,
          ...(selectedKeys.length > 0
            ? { idempotencyKey: { in: selectedKeys } }
            : {}),
        },
        select: {
          id: true,
          idempotencyKey: true,
          amount: true,
        },
      });

      if (selectedKeys.length > 0) {
        const found = new Set(
          transitBuildEntries.map((row) => row.idempotencyKey)
        );
        const missing = selectedKeys.filter((key) => !found.has(key));
        if (missing.length > 0) {
          return ApiResponse.badRequest(
            'Some selected transit build-up entries were not found',
            { missingIdempotencyKeys: missing.join(', ') }
          );
        }
      }

      if (transitBuildEntries.length === 0) {
        return ApiResponse.badRequest(
          'No transit build-up entries found for shipment',
          {
            shipmentCode,
            hint: 'Create transit build-up entries first (Dr Inventory in Transit / Cr Cash/Payables).',
          }
        );
      }

      const selectedTransitTotal = transitBuildEntries.reduce(
        (sum, row) => sum + Number(row.amount ?? 0),
        0
      );

      if (!Number.isFinite(selectedTransitTotal) || selectedTransitTotal <= 0) {
        return ApiResponse.badRequest('Transit build-up total is invalid', {
          shipmentCode,
          totalAmount: `${selectedTransitTotal}`,
        });
      }

      const transitBuildSources = new Set(
        transitBuildEntries.map((row) =>
          getTransitBuildEntrySource(row.idempotencyKey)
        )
      );

      if (transitBuildSources.has('unknown')) {
        return ApiResponse.badRequest(
          'Transit build-up entries use an unsupported source format',
          {
            shipmentCode,
            hint: 'Recreate the transit build-up entries using the current workflow before reclassing.',
          }
        );
      }

      if (transitBuildSources.size > 1) {
        return ApiResponse.badRequest(
          'Transit build-up entries mix different source flows',
          {
            shipmentCode,
            hint: 'Select only one transit build-up source flow at a time before reclassing.',
          }
        );
      }

      const products = await delegates.productModel.findMany({
        where: { shipmentCode, deletedAt: null, productCode: { not: null } },
        select: {
          id: true,
          productCode: true,
          cogs: true,
          grandTotal: true,
          forwardersFee: true,
          lalamove: true,
          packagingCost: true,
        },
      });

      if (products.length === 0) {
        return ApiResponse.badRequest('No products linked to shipment code', {
          shipmentCode,
          hint: 'Link at least one Product (with Product Code) to this Shipment Code before reclassing.',
        });
      }

      const sourceFlow = transitBuildSources.has('product')
        ? 'product'
        : 'shipment';

      let valuedProducts: Array<{ productCode: string; amount: number }> = [];
      let expectedTotalAmount = 0;

      if (sourceFlow === 'product') {
        const productCodeById = new Map<number, string>();
        products.forEach((product) => {
          const productId = Number(product.id ?? 0);
          const productCode = (product.productCode ?? '').trim();
          if (productId > 0 && productCode) {
            productCodeById.set(productId, productCode);
          }
        });

        const amountByProductCode = new Map<string, number>();
        for (const entry of transitBuildEntries) {
          const productId = parseProductIdFromTransitBuildKey(
            entry.idempotencyKey
          );
          const productCode = productId ? productCodeById.get(productId) : null;

          if (!productId || !productCode) {
            return ApiResponse.badRequest(
              'Transit build-up entry is missing a linked product',
              {
                shipmentCode,
                idempotencyKey: entry.idempotencyKey,
                hint: 'Ensure each product transit build-up entry still points to an active Product Code before reclassing.',
              }
            );
          }

          const nextAmount =
            Number(amountByProductCode.get(productCode) ?? 0) +
            Number(entry.amount ?? 0);
          amountByProductCode.set(productCode, nextAmount);
        }

        valuedProducts = Array.from(amountByProductCode.entries())
          .map(([productCode, amount]) => ({ productCode, amount }))
          .filter((row) => Number.isFinite(row.amount) && row.amount > 0);

        expectedTotalAmount = valuedProducts.reduce(
          (sum, row) => sum + row.amount,
          0
        );
      } else {
        valuedProducts = products
          .map((p) => {
            const productCode = (p.productCode ?? '').trim();
            if (!productCode) {
              return null;
            }

            const amount = computeExpectedAmount([p]);
            if (!Number.isFinite(amount) || amount <= 0) {
              return null;
            }

            return { productCode, amount };
          })
          .filter(Boolean) as Array<{ productCode: string; amount: number }>;

        expectedTotalAmount = valuedProducts.reduce(
          (sum, row) => sum + row.amount,
          0
        );

        if (toCents(expectedTotalAmount) !== toCents(selectedTransitTotal)) {
          return ApiResponse.badRequest(
            'Transit build-up total does not match product valuation total',
            {
              shipmentCode,
              expectedTotalAmount: `₱${expectedTotalAmount.toFixed(2)} (sum of linked Product COGS/derived COGS)`,
              selectedTransitTotalAmount: `₱${selectedTransitTotal.toFixed(2)}`,
              hint: 'Ensure your transit build-up entries exactly match the linked products total before reclassing.',
            }
          );
        }
      }

      const existingReclassEntries = await delegates.reclassModel.findMany({
        where: {
          shipmentCode,
          deletedAt: null,
          fromAccount: IN_TRANSIT_ACCOUNT,
          toAccount: STOCK_ON_HAND_ACCOUNT,
        },
        select: { productCode: true },
      });

      const alreadyReclassedProductCodes = new Set(
        existingReclassEntries.map((row) => (row.productCode ?? '').trim())
      );

      const sanitizedNotes = body?.notes ? sanitizers.notes(body.notes) : null;

      const rowsToCreate = valuedProducts
        .filter((row) => !alreadyReclassedProductCodes.has(row.productCode))
        .map((row) => ({
          postingDate,
          shipmentId: shipment.id,
          shipmentCode,
          productCode: row.productCode,
          amount: row.amount,
          fromAccount: IN_TRANSIT_ACCOUNT,
          toAccount: STOCK_ON_HAND_ACCOUNT,
          triggerStatus: 'Manual',
          idempotencyKey: `SHIPMENT_TRANSIT_RECLASS:${shipmentCode}:${row.productCode}`,
          notes: sanitizedNotes,
        }));

      if (rowsToCreate.length > 0) {
        await delegates.reclassModel.createMany({
          data: rowsToCreate,
          skipDuplicates: true,
        });
      }

      return ApiResponse.success(
        {
          shipmentId: shipment.id,
          shipmentCode,
          postingDate: postingDate.toISOString(),
          selectedTransitTotalAmount: selectedTransitTotal,
          expectedTotalAmount,
          createdCount: rowsToCreate.length,
          skippedCount: valuedProducts.length - rowsToCreate.length,
        },
        rowsToCreate.length === 0
          ? 'Reclass entries already exist for this shipment'
          : 'Reclass entries created'
      );
    }
  );

  return { POST };
}
