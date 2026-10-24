import { prisma } from '@/lib/db';
import { postExpenseForShipment } from '@/modules/shipments/api/expenses';
import { createShipmentDetailRoutes } from '@/modules/shipments/api/shipmentDetailRouteFactory';
import type { ShipmentDB } from '@/types';

const { GET, PUT, DELETE } = createShipmentDetailRoutes({
  shipmentModel: prisma.shipment,
  productModel: prisma.product,
  transactionModel: prisma.transaction,
  hasActiveAccountingEntriesForShipmentCode: async (shipmentCode) => {
    const [transitBuildCount, reclassCount] = await Promise.all([
      prisma.clothingInventoryTransitBuildEntry.count({
        where: { shipmentCode, deletedAt: null },
      }),
      prisma.clothingInventoryReclassEntry.count({
        where: { shipmentCode, deletedAt: null },
      }),
    ]);
    return transitBuildCount > 0 || reclassCount > 0;
  },
  postExpenseForShipment: (shipment) =>
    postExpenseForShipment(shipment as ShipmentDB),
  enableDelete: true,
});

export { GET, PUT, DELETE };
