import { prisma } from '@/lib/db';
import { postExpenseForShipment } from '@/modules/shipments/api/expenses';
import { createShipmentDetailRoutes } from '@/modules/shipments/api/shipmentDetailRouteFactory';
import type { ShipmentDB } from '@/types';

const { GET, PUT, DELETE } = createShipmentDetailRoutes({
  shipmentModel: prisma.shipment,
  productModel: prisma.product,
  transactionModel: prisma.transaction,
  postExpenseForShipment: (shipment) =>
    postExpenseForShipment(shipment as ShipmentDB),
  enableDelete: true,
});

export { GET, PUT, DELETE };
