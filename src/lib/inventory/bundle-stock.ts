import type { Prisma } from '@prisma/client';
import { FinancialOperationError } from '@/lib/accounting/financial-transactions';
import { isKnownZeroAcquisitionCost } from '@/lib/accounting/inventoryCogsShared';
import {
  allocateInventoryCostLots,
  loadAvailableInventoryCostLots,
} from './cost-lots';

export async function assembleInventoryBundle(
  client: Prisma.TransactionClient,
  input: {
    batchId: number;
    bundleSku: string;
    bundleName: string;
    quantity: number;
    postingDate: string;
    components: Array<{ productCode: string; includedQuantity: number }>;
  }
) {
  const stocks = [];
  for (const component of input.components) {
    const lots = await loadAvailableInventoryCostLots(
      client,
      component.productCode,
      null,
      null,
      input.postingDate
    );
    const allocation = lots
      ? allocateInventoryCostLots(
          lots,
          component.includedQuantity * input.quantity
        )
      : null;
    if (!allocation) {
      throw new FinancialOperationError(
        `Not enough recorded sellable stock for component ${component.productCode}.`
      );
    }
    if (
      allocation.some(
        (lot) =>
          lot.unitCost === null ||
          !Number.isFinite(lot.unitCost) ||
          lot.unitCost < 0 ||
          (lot.unitCost === 0 && !isKnownZeroAcquisitionCost(lot))
      )
    ) {
      throw new FinancialOperationError(
        `Resolve the acquisition cost for component ${component.productCode}.`
      );
    }
    stocks.push({ ...component, lots: allocation.map((lot) => ({ ...lot })) });
  }
  const existing = await client.product.findFirst({
    where: {
      deletedAt: null,
      productCode: { equals: input.bundleSku, mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (!existing) {
    await client.product.create({
      data: {
        productCode: input.bundleSku,
        product: input.bundleName,
        quantity: 0,
        cogs: 0,
        shipmentStatus: 'Delivered',
      },
    });
  }
  let remaining = input.quantity;
  let index = 0;
  while (remaining > 0.000001) {
    const quantity = Math.min(
      remaining,
      ...stocks.map((stock) => stock.lots[0].quantity / stock.includedQuantity)
    );
    const notes = `bundle-assembly batch ${input.batchId} sku ${input.bundleSku} lot ${index}`;
    let unitCost = 0;
    let firstSource: number | null = null;
    for (const stock of stocks) {
      const lot = stock.lots[0];
      const consumed = quantity * stock.includedQuantity;
      const movement = await client.inventoryMovement.create({
        data: {
          productCode: stock.productCode,
          quantity: consumed,
          unitCost: lot.unitCost,
          costBasis: lot.costBasis,
          sourceMovementId: lot.sourceMovementId,
          fromBucket: 'sellable',
          toBucket: 'opening_inventory',
          movementSource: 'inventory_bundle',
          movementType: 'bundle_component_out',
          postingDate: input.postingDate,
          notes,
        },
      });
      firstSource ??= movement.id;
      unitCost += (lot.unitCost ?? 0) * stock.includedQuantity;
      lot.quantity -= consumed;
      if (lot.quantity <= 0.000001) {
        stock.lots.shift();
      }
    }
    await client.inventoryMovement.create({
      data: {
        productCode: input.bundleSku,
        quantity,
        unitCost,
        costBasis: 'ASSEMBLY',
        sourceMovementId: firstSource,
        fromBucket: 'opening_inventory',
        toBucket: 'sellable',
        movementSource: 'inventory_bundle',
        movementType: 'bundle_receipt',
        postingDate: input.postingDate,
        notes,
      },
    });
    remaining -= quantity;
    index += 1;
  }
}
