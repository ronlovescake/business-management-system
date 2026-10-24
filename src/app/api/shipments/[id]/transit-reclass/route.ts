import { prisma } from '@/lib/db';
import { withErrorHandler } from '@/core/api/middleware';
import { createTransitReclassRoutes } from '@/modules/shipments/api/transitReclassRouteFactory';

const POST = withErrorHandler<{ params: { id: string } }>((request, context) =>
  prisma.$transaction(
    (tx) =>
      createTransitReclassRoutes({
        useProductIdentity: true,
        shipmentModel: tx.shipment,
        productModel: tx.product,
        transitBuildModel: tx.clothingInventoryTransitBuildEntry,
        reclassModel: tx.clothingInventoryReclassEntry,
      }).POST(request, context),
    { isolationLevel: 'Serializable' }
  )
);

export { POST };
