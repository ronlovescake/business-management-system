import { prisma } from '@/lib/db';
import { withErrorHandler } from '@/core/api/middleware';
import { createTransitReclassRoutes } from '@/modules/shipments/api/transitReclassRouteFactory';
import { parseProductIdFromTransitBuildKey } from '@/modules/shipments/api/shipmentUtils';

const POST = withErrorHandler<{ params: { id: string } }>((request, context) =>
  prisma.$transaction(
    (tx) =>
      createTransitReclassRoutes({
        useProductIdentity: true,
        validateProductSelection: async (keys) => {
          const productIds = keys
            .map(parseProductIdFromTransitBuildKey)
            .filter((id): id is number => id !== null);
          const products = await tx.product.findMany({
            where: { id: { in: productIds }, deletedAt: null },
            select: { id: true, supplierFulfillmentStatus: true },
          });
          if (
            products.some(
              (product) => product.supplierFulfillmentStatus === 'CREDIT_ISSUED'
            )
          ) {
            return 'A supplier-nonfulfilled product cannot be reclassified to Stock on Hand.';
          }
          const allEntries =
            await tx.clothingInventoryTransitBuildEntry.findMany({
              where: {
                deletedAt: null,
                OR: productIds.map((id) => ({
                  idempotencyKey: {
                    startsWith: `PRODUCT_TRANSIT_BUILD:${id}:`,
                  },
                })),
              },
              select: { idempotencyKey: true },
            });
          if (
            allEntries.some((entry) => !keys.includes(entry.idempotencyKey))
          ) {
            return 'Select all funding components of each product together.';
          }
          return null;
        },
        shipmentModel: tx.shipment,
        productModel: tx.product,
        transitBuildModel: tx.clothingInventoryTransitBuildEntry,
        reclassModel: tx.clothingInventoryReclassEntry,
      }).POST(request, context),
    { isolationLevel: 'Serializable' }
  )
);

export { POST };
