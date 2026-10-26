import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { withErrorHandler } from '@/core/api/middleware';
import { createTransitBuildRoutes } from '@/modules/shipments/api/transitBuildRouteFactory';
import { hasSupplierSettlementForTransitKeys } from '@/lib/accounting/supplier-settlement-dependencies';

function routesFor(
  client: Pick<
    Prisma.TransactionClient,
    | 'shipment'
    | 'product'
    | 'clothingInventoryTransitBuildEntry'
    | 'clothingInventoryReclassEntry'
    | 'clothingAccountingJournalLine'
  >
) {
  return createTransitBuildRoutes({
    enforceExclusiveSource: true,
    includeSupplierState: true,
    hasActiveReclass: async (shipmentCode) =>
      (await client.clothingInventoryReclassEntry.count({
        where: { shipmentCode, deletedAt: null },
      })) > 0,
    hasActiveSupplierSettlement: async (shipmentCode) => {
      const entries = await client.clothingInventoryTransitBuildEntry.findMany({
        where: { shipmentCode, deletedAt: null },
        select: { idempotencyKey: true },
      });
      return hasSupplierSettlementForTransitKeys(
        client,
        entries.map((entry) => entry.idempotencyKey)
      );
    },
    shipmentModel: client.shipment,
    productModel: client.product,
    transitBuildModel: client.clothingInventoryTransitBuildEntry,
    $transaction: (ops) => Promise.all(ops),
  });
}

const writeRoute = (method: 'POST' | 'PATCH' | 'DELETE') =>
  withErrorHandler<{ params: { id: string } }>((request, context) =>
    prisma.$transaction((tx) => routesFor(tx)[method](request, context), {
      isolationLevel: 'Serializable',
    })
  );

const GET = routesFor(prisma).GET;
const POST = writeRoute('POST');
const PATCH = writeRoute('PATCH');
const DELETE = writeRoute('DELETE');

export { GET, POST, PATCH, DELETE };
