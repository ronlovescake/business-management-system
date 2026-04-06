import { prisma } from '@/lib/db';
import { createTransitReclassRoutes } from '@/modules/shipments/api/transitReclassRouteFactory';

const { POST } = createTransitReclassRoutes({
  shipmentModel: prisma.shipment,
  productModel: prisma.product,
  transitBuildModel: prisma.clothingInventoryTransitBuildEntry,
  reclassModel: prisma.clothingInventoryReclassEntry,
});

export { POST };
