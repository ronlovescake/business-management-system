import { prisma } from '@/lib/db';
import { postExpenseForShipment } from '@/modules/shipments/api/expenses';
import { createShipmentDetailRoutes } from '@/modules/shipments/api/shipmentDetailRouteFactory';
import type { ShipmentDB } from '@/types';

const { GET, PUT } = createShipmentDetailRoutes({
  shipmentModel: prisma.generalMerchandiseShipment,
  productModel: prisma.generalMerchandiseProduct,
  transactionModel: prisma.generalMerchandiseTransaction,
  postExpenseForShipment: (shipment) =>
    postExpenseForShipment(shipment as ShipmentDB),
  enableDelete: false,
  domainLabel: 'GM',
});

export { GET, PUT };
