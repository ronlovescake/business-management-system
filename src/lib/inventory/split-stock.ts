import type { InventoryMovement, Prisma } from '@prisma/client';
import { FinancialOperationError } from '@/lib/accounting/financial-transactions';
import {
  allocateInventoryCostLots,
  loadAvailableInventoryCostLots,
  type InventoryCostLot,
} from './cost-lots';

export async function ensureSplitChildStock(
  client: Prisma.TransactionClient,
  input: {
    splitBatchId: number;
    parentSku: string;
    componentSku: string;
    quantity: number;
    transactionId: number;
    postingDate: string | null;
  }
) {
  const batch = await client.splitBatch.findUnique({
    where: { id: input.splitBatchId },
    include: { components: true },
  });
  const requested = batch?.components.find(
    (component) =>
      component.componentSku.toLowerCase() === input.componentSku.toLowerCase()
  );
  if (!batch || !requested || requested.includedQuantity <= 0) {
    throw new FinancialOperationError(
      'Review the original split definition before opening stock.'
    );
  }
  const current = await loadAvailableInventoryCostLots(
    client,
    requested.componentSku,
    input.transactionId,
    null,
    input.postingDate
  );
  const available =
    current?.reduce((total, lot) => total + lot.quantity, 0) ?? 0;
  if (available + 0.000001 >= input.quantity) {
    return;
  }
  if (
    batch.components.some(
      (component) =>
        component.acquisitionUnitCost === null ||
        !Number.isFinite(component.acquisitionUnitCost) ||
        component.acquisitionUnitCost < 0 ||
        !Number.isFinite(component.includedQuantity) ||
        component.includedQuantity <= 0
    )
  ) {
    throw new FinancialOperationError(
      'Record explicit acquisition costs for every split component before opening a parent set.'
    );
  }
  const parentLots = await loadAvailableInventoryCostLots(
    client,
    input.parentSku,
    input.transactionId,
    null,
    input.postingDate
  );
  const count = Math.ceil(
    (input.quantity - available) / requested.includedQuantity
  );
  const allocation = parentLots
    ? allocateInventoryCostLots(parentLots, count)
    : null;
  if (!allocation) {
    throw new FinancialOperationError(
      'Not enough recorded complete parent sets remain.'
    );
  }
  const componentCost = batch.components.reduce(
    (total, component) =>
      total + component.includedQuantity * component.acquisitionUnitCost!,
    0
  );
  for (const lot of allocation) {
    const free = lot.costBasis === 'FREE_GOODS' && lot.unitCost === 0;
    if (
      lot.unitCost === null ||
      !Number.isFinite(lot.unitCost) ||
      lot.unitCost < 0 ||
      (!free &&
        (lot.unitCost === 0 ||
          Math.abs(componentCost - lot.unitCost) > 0.000001))
    ) {
      throw new FinancialOperationError(
        'Component acquisition costs must exactly conserve the recorded parent receipt cost.'
      );
    }
  }
  for (const lot of allocation) {
    const note = `split:${batch.id}: opening for transaction ${input.transactionId}`;
    const opening = await client.inventoryMovement.create({
      data: {
        productCode: input.parentSku,
        quantity: lot.quantity,
        unitCost: lot.unitCost,
        costBasis: lot.costBasis,
        sourceMovementId: lot.sourceMovementId,
        fromBucket: 'sellable',
        toBucket: 'opening_inventory',
        movementSource: 'inventory_split',
        movementType: 'split_open',
        postingDate: input.postingDate,
        notes: note,
      },
    });
    for (const component of batch.components) {
      const free = lot.costBasis === 'FREE_GOODS' && lot.unitCost === 0;
      const unitCost = free ? 0 : component.acquisitionUnitCost!;
      const product = await client.product.findFirst({
        where: {
          deletedAt: null,
          productCode: { equals: component.componentSku, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (!product) {
        await client.product.create({
          data: {
            productCode: component.componentSku,
            product: component.componentLabel,
            quantity: 0,
            cogs: 0,
            landedUnitCost: unitCost,
            shipmentStatus: 'Delivered',
          },
        });
      }
      await client.inventoryMovement.create({
        data: {
          productCode: component.componentSku,
          quantity: lot.quantity * component.includedQuantity,
          unitCost,
          costBasis: free ? 'FREE_GOODS' : 'SPLIT_ALLOCATION',
          sourceMovementId: opening.id,
          fromBucket: 'opening_inventory',
          toBucket: 'sellable',
          movementSource: 'inventory_split',
          movementType: 'split_piece_receipt',
          postingDate: input.postingDate,
          notes: note,
        },
      });
    }
  }
}

async function findOpening(
  client: Prisma.TransactionClient,
  movementId: number
) {
  const visited = new Set<number>();
  let currentId: number | null = movementId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const movement: InventoryMovement | null =
      await client.inventoryMovement.findUnique({ where: { id: currentId } });
    if (!movement) {
      return null;
    }
    if (
      movement.movementSource === 'inventory_split' &&
      movement.movementType === 'split_open'
    ) {
      return movement;
    }
    currentId = movement.sourceMovementId;
  }
  return null;
}

export async function rebuildReturnedSplitSets(
  client: Prisma.TransactionClient,
  productCode: string,
  postingDate: string
) {
  const component = await client.splitBatchComponent.findFirst({
    where: { componentSku: { equals: productCode, mode: 'insensitive' } },
    include: { splitBatch: { include: { components: true } } },
  });
  if (!component) {
    return;
  }
  const batch = component.splitBatch;
  const grouped = new Map<number, Map<string, InventoryCostLot[]>>();
  for (const piece of batch.components) {
    const lots = await loadAvailableInventoryCostLots(
      client,
      piece.componentSku,
      null,
      null,
      postingDate
    );
    for (const lot of lots ?? []) {
      const opening = await findOpening(client, lot.sourceMovementId);
      if (
        !opening ||
        opening.productCode.toLowerCase() !== batch.splitSku.toLowerCase()
      ) {
        continue;
      }
      if (!grouped.has(opening.id)) {
        grouped.set(opening.id, new Map());
      }
      const byCode = grouped.get(opening.id)!;
      byCode.set(piece.componentSku, [
        ...(byCode.get(piece.componentSku) ?? []),
        lot,
      ]);
    }
  }
  for (const [openingId, byCode] of Array.from(grouped.entries())) {
    const opening = await client.inventoryMovement.findUniqueOrThrow({
      where: { id: openingId },
    });
    const previous = await client.inventoryMovement.findMany({
      where: {
        deletedAt: null,
        sourceMovementId: openingId,
        movementType: 'split_rebuild_receipt',
      },
    });
    const remaining =
      opening.quantity -
      previous.reduce((total, movement) => total + movement.quantity, 0);
    const sets = Math.min(
      remaining,
      ...batch.components.map((piece) =>
        Math.floor(
          (byCode.get(piece.componentSku) ?? []).reduce(
            (total, lot) => total + lot.quantity,
            0
          ) / piece.includedQuantity
        )
      )
    );
    if (sets <= 0) {
      continue;
    }
    const selected = batch.components.map((piece) => ({
      piece,
      lots: allocateInventoryCostLots(
        byCode.get(piece.componentSku) ?? [],
        sets * piece.includedQuantity
      )!,
    }));
    const value = selected.reduce(
      (total, item) =>
        total +
        item.lots.reduce(
          (amount, lot) => amount + lot.quantity * (lot.unitCost ?? NaN),
          0
        ),
      0
    );
    if (
      opening.unitCost === null ||
      !Number.isFinite(value) ||
      Math.abs(value - sets * opening.unitCost) > 0.000001
    ) {
      continue;
    }
    const notes = `split:${batch.id}: rebuild original opening ${openingId}`;
    for (const item of selected) {
      for (const lot of item.lots) {
        await client.inventoryMovement.create({
          data: {
            productCode: item.piece.componentSku,
            quantity: lot.quantity,
            unitCost: lot.unitCost,
            costBasis: lot.costBasis,
            sourceMovementId: lot.sourceMovementId,
            fromBucket: 'sellable',
            toBucket: 'opening_inventory',
            movementSource: 'inventory_split',
            movementType: 'split_rebuild_out',
            postingDate,
            notes,
          },
        });
      }
    }
    await client.inventoryMovement.create({
      data: {
        productCode: batch.splitSku,
        quantity: sets,
        unitCost: opening.unitCost,
        costBasis: opening.costBasis,
        sourceMovementId: openingId,
        fromBucket: 'opening_inventory',
        toBucket: 'sellable',
        movementSource: 'inventory_split',
        movementType: 'split_rebuild_receipt',
        postingDate,
        notes,
      },
    });
  }
}
