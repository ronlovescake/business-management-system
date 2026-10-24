import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';

export async function createClothingAccountingFixture() {
  const shipmentCode = `AUDIT-${randomUUID().slice(0, 8)}`;
  const shipment = await prisma.shipment.create({
    data: {
      shipmentCode,
      shipmentStatus: 'Delivered',
      dateDelivered: '2026-10-24',
    },
  });
  const product = await prisma.product.create({
    data: {
      product: 'Audit product',
      productCode: shipmentCode,
      shipmentCode,
      payment: 'Unpaid',
      paymentMethod: 'BANK',
      postingDate: '2026-10-24',
      unitPrice: 10,
      exchangeRates: 1,
      quantity: 10,
      grandTotal: 100,
      cogs: 100,
    },
  });
  await prisma.inventoryMovement.create({
    data: {
      productId: product.id,
      productCode: shipmentCode,
      quantity: 10,
      fromBucket: 'opening_inventory',
      toBucket: 'sellable',
      movementSource: 'product',
      notes: `Receipt for product #${product.id}`,
    },
  });
  return { shipment, product, shipmentCode };
}
