import type { Prisma } from '@prisma/client';
import {
  INVENTORY_ASSET_BUCKETS,
  isKnownZeroAcquisitionCost,
} from '@/lib/accounting/inventoryCogsShared';
import { pickUnitCostFromProductRow } from '@/lib/accounting/inventoryCogsShared';
import { FinancialOperationError } from '@/lib/accounting/financial-transactions';

export type InventoryCostLot = {
  sourceMovementId: number;
  quantity: number;
  unitCost: number | null;
  costBasis: string | null;
};

export async function loadAvailableInventoryCostLots(
  client: Prisma.TransactionClient,
  productCode: string,
  transactionId: number | null,
  fallbackUnitCost: number | null,
  postingDate: string | null
): Promise<InventoryCostLot[] | null> {
  const movements = await client.inventoryMovement.findMany({
    where: {
      deletedAt: null,
      productCode: { equals: productCode, mode: 'insensitive' },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      productCode: true,
      quantity: true,
      unitCost: true,
      costBasis: true,
      sourceMovementId: true,
      sourceTransactionId: true,
      fromBucket: true,
      toBucket: true,
      postingDate: true,
    },
  });
  const lots: Array<InventoryCostLot & { bucket: string }> = [];
  let hasReceipt = false;
  for (const movement of movements) {
    if (
      !movement.id ||
      !Number.isFinite(movement.quantity) ||
      movement.quantity <= 0 ||
      (transactionId !== null && movement.sourceTransactionId === transactionId)
    ) {
      continue;
    }
    const fromAsset = INVENTORY_ASSET_BUCKETS.has(movement.fromBucket);
    const toAsset = INVENTORY_ASSET_BUCKETS.has(movement.toBucket);
    if (toAsset && !fromAsset) {
      hasReceipt = true;
    }
    if (
      postingDate &&
      movement.postingDate &&
      movement.postingDate.slice(0, 10) > postingDate.slice(0, 10)
    ) {
      continue;
    }
    if (toAsset && !fromAsset) {
      lots.push({
        bucket: movement.toBucket,
        sourceMovementId: movement.id,
        quantity: movement.quantity,
        unitCost:
          movement.costBasis === 'FREE_GOODS' && movement.unitCost === 0
            ? 0
            : (movement.unitCost ?? fallbackUnitCost),
        costBasis:
          movement.costBasis ??
          (movement.unitCost !== null && movement.unitCost !== undefined
            ? 'RECORDED_COST'
            : fallbackUnitCost !== null
              ? 'PURCHASE'
              : null),
      });
    } else if (fromAsset) {
      let remaining = movement.quantity;
      const candidates = lots.filter(
        (lot) =>
          lot.bucket === movement.fromBucket &&
          (!movement.sourceMovementId ||
            lot.sourceMovementId === movement.sourceMovementId)
      );
      for (const lot of candidates) {
        const consumed = Math.min(Math.max(lot.quantity, 0), remaining);
        lot.quantity -= consumed;
        remaining -= consumed;
        if (toAsset && consumed > 0) {
          lots.push({ ...lot, quantity: consumed, bucket: movement.toBucket });
        }
        if (remaining <= 0.000001) {
          break;
        }
      }
    }
  }
  return hasReceipt
    ? lots
        .filter((lot) => lot.bucket === 'sellable' && lot.quantity > 0.000001)
        .map(({ bucket: _bucket, ...lot }) => lot)
    : null;
}

export function allocateInventoryCostLots(
  lots: InventoryCostLot[],
  quantity: number
): InventoryCostLot[] | null {
  let remaining = quantity;
  const allocation: InventoryCostLot[] = [];
  for (const lot of lots) {
    const taken = Math.min(lot.quantity, remaining);
    if (taken > 0) {
      allocation.push({ ...lot, quantity: taken });
    }
    remaining -= taken;
    if (remaining <= 0.000001) {
      return allocation;
    }
  }
  return remaining <= 0.000001 ? allocation : null;
}

export async function transferInventoryCostLots(
  client: Prisma.TransactionClient,
  input: {
    productCode: string;
    transferToProductCode: string;
    quantity: number;
    postingDate: string;
    notes?: string;
    reverseTransfer?: boolean;
  },
  requestId: string
) {
  const source = await client.product.findFirst({
    where: {
      deletedAt: null,
      productCode: { equals: input.productCode.trim(), mode: 'insensitive' },
    },
  });
  const destination = await client.product.findFirst({
    where: {
      deletedAt: null,
      productCode: {
        equals: input.transferToProductCode.trim(),
        mode: 'insensitive',
      },
    },
  });
  if (!source?.productCode || !destination?.productCode) {
    throw new FinancialOperationError(
      'Both transfer products must exist.',
      404
    );
  }
  if (source.id === destination.id) {
    throw new FinancialOperationError('Transfer products must differ.', 400);
  }
  if (
    source.supplierFulfillmentStatus === 'CREDIT_ISSUED' ||
    destination.supplierFulfillmentStatus === 'CREDIT_ISSUED'
  ) {
    throw new FinancialOperationError(
      'Supplier-nonfulfilled products cannot participate in physical transfers.'
    );
  }
  let lots = await loadAvailableInventoryCostLots(
    client,
    source.productCode,
    null,
    pickUnitCostFromProductRow(source) || null,
    input.postingDate
  );
  if (input.reverseTransfer && lots) {
    const originalReceipts = await client.inventoryMovement.findMany({
      where: {
        deletedAt: null,
        productCode: source.productCode,
        movementSource: 'inventory_transfer',
        movementType: 'transfer_in',
        sourceMovement: { productCode: destination.productCode },
      },
      select: { id: true },
    });
    const originalIds = new Set(
      originalReceipts.map((movement) => movement.id)
    );
    lots = lots.filter((lot) => originalIds.has(lot.sourceMovementId));
  }
  const allocation = lots
    ? allocateInventoryCostLots(lots, input.quantity)
    : null;
  if (!allocation) {
    throw new FinancialOperationError(
      'Not enough recorded sellable stock remains for this transfer.'
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
      'Resolve the source acquisition cost before transferring these units.'
    );
  }
  const notes = `transfer: from:${source.productCode.toLowerCase()}; to:${destination.productCode.toLowerCase()}; request:${requestId}${input.notes ? `; note:${input.notes}` : ''}`;
  const movements = [];
  for (const lot of allocation) {
    const outbound = await client.inventoryMovement.create({
      data: {
        productCode: source.productCode,
        quantity: lot.quantity,
        unitCost: lot.unitCost,
        costBasis: lot.costBasis,
        sourceMovementId: lot.sourceMovementId,
        fromBucket: 'sellable',
        toBucket: 'supplier_short',
        movementSource: 'inventory_transfer',
        movementType: input.reverseTransfer
          ? 'transfer_reversal_out'
          : 'transfer_out',
        postingDate: input.postingDate,
        notes,
      },
    });
    const inbound = await client.inventoryMovement.create({
      data: {
        productCode: destination.productCode,
        quantity: lot.quantity,
        unitCost: lot.unitCost,
        costBasis: lot.costBasis,
        sourceMovementId: outbound.id,
        fromBucket: 'supplier_short',
        toBucket: 'sellable',
        movementSource: 'inventory_transfer',
        movementType: input.reverseTransfer
          ? 'transfer_reversal_in'
          : 'transfer_in',
        postingDate: input.postingDate,
        notes,
      },
    });
    movements.push(outbound, inbound);
  }
  return { data: movements[0], movements };
}
