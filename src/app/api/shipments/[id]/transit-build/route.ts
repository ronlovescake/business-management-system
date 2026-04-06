import { prisma } from '@/lib/db';
import { createTransitBuildRoutes } from '@/modules/shipments/api/transitBuildRouteFactory';

const { GET, POST, PATCH, DELETE } = createTransitBuildRoutes({
  shipmentModel: prisma.shipment,
  productModel: prisma.product,
  transitBuildModel: prisma.clothingInventoryTransitBuildEntry,
  $transaction: (ops) => prisma.$transaction(ops),
});

export { GET, POST, PATCH, DELETE };
