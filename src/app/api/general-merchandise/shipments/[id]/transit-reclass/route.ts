import { prisma } from '@/lib/db';
import { createTransitReclassRoutes } from '@/modules/shipments/api/transitReclassRouteFactory';

const { POST } = createTransitReclassRoutes({
  shipmentModel: prisma.generalMerchandiseShipment,
  productModel: prisma.generalMerchandiseProduct,
  transitBuildModel: prisma.generalMerchandiseInventoryTransitBuildEntry,
  reclassModel: prisma.generalMerchandiseInventoryReclassEntry,
});

export { POST };
