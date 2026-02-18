import type {
  InventoryItem,
  InventoryTotals,
  ProductFromAPI,
  BundleBatchFromAPI,
  MixAndMatchBatchFromAPI,
  TransactionFromAPI,
  InventoryMovementFromAPI,
} from '../types';
import {
  buildBucketDeltaMap,
  normalizeProductCode,
} from '@/lib/inventory/movements';
import { isFulfilledStatus, isReservedStatus } from '@/lib/inventory/statuses';
import { isCancelledOrderStatus } from '@/lib/transactions/order-status';

export function extractApiData<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: T[] }).data;
  }

  return [];
}

export function buildInventoryItems(
  products: ProductFromAPI[],
  transactions: TransactionFromAPI[],
  bundles: BundleBatchFromAPI[] = [],
  movements: InventoryMovementFromAPI[] = [],
  mixAndMatchBatches: MixAndMatchBatchFromAPI[] = []
): InventoryItem[] {
  const ADDITIONALS_NOTE_PREFIX = 'additionals';
  const TRANSFER_NOTE_PREFIX = 'transfer';

  // Operational inventory source of truth:
  // - baseline supply from Products quantity
  // - minus reserved demand where RESERVED is any non-cancelled order status
  //   except Ready For Dispatch, Checked Out, and Shipped.
  // Accounting posting/recognition rules remain unchanged elsewhere.
  const committedQtyByProduct = new Map<string, number>();

  const damagedDeltaByProduct = buildBucketDeltaMap(movements, 'damaged_hold');
  const supplierShortDeltaByProduct = new Map<string, number>();
  const soldQtyByProduct = new Map<string, number>();
  const mixReservedQtyByProduct = new Map<string, number>();
  const mixSoldQtyByProduct = new Map<string, number>();
  const scrapQtyByProduct = new Map<string, number>();
  const additionalsQtyByProduct = new Map<string, number>();
  const transferSellableDeltaByProduct = new Map<string, number>();
  const totalSalesByProduct = new Map<string, number>();

  const soldOrderStatuses = new Set([
    'ready for dispatch',
    'checked out',
    'shipped',
  ]);

  // Bundles are currently unused for inventory availability calculations on this page.
  // (We intentionally ignore them here to avoid surfacing confusing “reserved qty” logic.)
  void bundles;

  // ============================================================================
  // ⚠️ OPERATIONAL SALES (INVENTORY VIEW)
  // ============================================================================
  // This view uses operational fulfillment statuses for Total Sales (not payments).
  // Cancelled orders are excluded using the shared helper ("Cancelled" only).
  // ============================================================================
  transactions.forEach((transaction) => {
    const productCode = transaction['Product Code'];
    const orderStatus = transaction['Order Status'];
    const quantity = transaction.Quantity || 0;
    const unitPrice = transaction['Unit Price'] || 0;
    const normalizedProductCode = normalizeProductCode(productCode);

    const isCancelled = isCancelledOrderStatus(orderStatus);
    if (isCancelled || !normalizedProductCode) {
      return;
    }

    const normalizedOrderStatus = (orderStatus ?? '').trim().toLowerCase();
    const fulfilledStatus = isFulfilledStatus(orderStatus);
    const shouldCountAsRevenue =
      isReservedStatus(orderStatus) || fulfilledStatus;
    const shouldCountAsReserved = !soldOrderStatuses.has(normalizedOrderStatus);

    if (shouldCountAsReserved) {
      const currentCommitted =
        committedQtyByProduct.get(normalizedProductCode) || 0;
      committedQtyByProduct.set(
        normalizedProductCode,
        currentCommitted + quantity
      );
    }

    if (soldOrderStatuses.has(normalizedOrderStatus)) {
      const currentSoldQty = soldQtyByProduct.get(normalizedProductCode) || 0;
      soldQtyByProduct.set(normalizedProductCode, currentSoldQty + quantity);
    }

    // NOTE: We intentionally do not derive “reserved qty” from order statuses.
    // This inventory view treats sellable availability as the source of truth.

    if (shouldCountAsRevenue) {
      const currentTotalSales =
        totalSalesByProduct.get(normalizedProductCode) || 0;
      totalSalesByProduct.set(
        normalizedProductCode,
        currentTotalSales + unitPrice * quantity
      );
    }
  });

  // NOTE: In this system, the `scrap` bucket is also used as an external source bucket
  // (e.g., receipts may move `scrap -> sellable`). Because of that, using net bucket deltas
  // for `scrap` can go negative and becomes confusing. For UI reporting, we track *write-offs*
  // as the cumulative quantity moved *into* `scrap` from any non-scrap bucket.
  movements.forEach((movement) => {
    const normalizedProductCode = normalizeProductCode(movement.productCode);
    if (!normalizedProductCode || !Number.isFinite(movement.quantity)) {
      return;
    }

    const qty = movement.quantity ?? 0;
    const isAdditionalsMovement = (movement.notes ?? '')
      .toLowerCase()
      .startsWith(ADDITIONALS_NOTE_PREFIX);
    const isTransferMovement = (movement.notes ?? '')
      .toLowerCase()
      .startsWith(TRANSFER_NOTE_PREFIX);

    if (
      !isAdditionalsMovement &&
      !isTransferMovement &&
      ((movement.fromBucket === 'sellable' &&
        movement.toBucket === 'supplier_short') ||
        (movement.fromBucket === 'supplier_short' &&
          movement.toBucket === 'sellable'))
    ) {
      const direction = movement.toBucket === 'supplier_short' ? 1 : -1;
      const currentSupplierShortQty =
        supplierShortDeltaByProduct.get(normalizedProductCode) ?? 0;
      supplierShortDeltaByProduct.set(
        normalizedProductCode,
        currentSupplierShortQty + qty * direction
      );
    }

    if (
      isTransferMovement &&
      ((movement.fromBucket === 'sellable' &&
        movement.toBucket === 'supplier_short') ||
        (movement.fromBucket === 'supplier_short' &&
          movement.toBucket === 'sellable'))
    ) {
      const direction =
        movement.fromBucket === 'sellable' &&
        movement.toBucket === 'supplier_short'
          ? -1
          : movement.fromBucket === 'supplier_short' &&
              movement.toBucket === 'sellable'
            ? 1
            : 0;

      if (direction !== 0) {
        const currentTransferDelta =
          transferSellableDeltaByProduct.get(normalizedProductCode) ?? 0;
        transferSellableDeltaByProduct.set(
          normalizedProductCode,
          currentTransferDelta + qty * direction
        );
      }
    }

    if (isAdditionalsMovement) {
      const direction =
        movement.fromBucket === 'supplier_short' &&
        movement.toBucket === 'sellable'
          ? 1
          : movement.fromBucket === 'sellable' &&
              movement.toBucket === 'supplier_short'
            ? -1
            : 0;

      if (direction !== 0) {
        const currentAdditionals =
          additionalsQtyByProduct.get(normalizedProductCode) ?? 0;
        additionalsQtyByProduct.set(
          normalizedProductCode,
          currentAdditionals + qty * direction
        );
      }
    }

    if (movement.toBucket !== 'scrap' || movement.fromBucket === 'scrap') {
      return;
    }

    const current = scrapQtyByProduct.get(normalizedProductCode) ?? 0;
    scrapQtyByProduct.set(normalizedProductCode, current + qty);
  });

  const actualQuantityByProduct = new Map<string, number>();
  const remainingSellableQtyByProduct = new Map<string, number>();

  products.forEach((product) => {
    const normalizedProductCode = normalizeProductCode(product['Product Code']);
    if (!normalizedProductCode) {
      return;
    }

    const quantity = product.Quantity || 0;
    const damagedOnHand = damagedDeltaByProduct.get(normalizedProductCode) || 0;
    const manualSupplierShortQty = Math.max(
      supplierShortDeltaByProduct.get(normalizedProductCode) || 0,
      0
    );
    const additionalsQty = Math.max(
      additionalsQtyByProduct.get(normalizedProductCode) || 0,
      0
    );
    const transferSellableDelta =
      transferSellableDeltaByProduct.get(normalizedProductCode) || 0;
    const committedQty = committedQtyByProduct.get(normalizedProductCode) || 0;
    const soldQty = soldQtyByProduct.get(normalizedProductCode) || 0;

    const actualQuantityReceived = Math.max(
      quantity + additionalsQty - manualSupplierShortQty - damagedOnHand,
      0
    );
    const directSellableQty = Math.max(
      actualQuantityReceived - committedQty - soldQty + transferSellableDelta,
      0
    );

    actualQuantityByProduct.set(normalizedProductCode, actualQuantityReceived);
    remainingSellableQtyByProduct.set(normalizedProductCode, directSellableQty);
  });

  const allocateMixDemandToComponents = (
    normalizedMixSku: string,
    demandByProduct: Map<string, number>,
    allocatedQtyByProduct: Map<string, number>
  ) => {
    const totalDemandUnits = demandByProduct.get(normalizedMixSku) || 0;
    if (totalDemandUnits <= 0) {
      return;
    }

    const mixBatch = mixAndMatchBatches.find(
      (batch) => normalizeProductCode(batch.mixAndMatchSku) === normalizedMixSku
    );
    if (!mixBatch) {
      return;
    }

    let remainingDemandUnits = totalDemandUnits;
    const normalizedComponents = mixBatch.components
      .map((component) => ({
        code: normalizeProductCode(component.productCode),
        includedQty: Number(component.includedQuantity) || 0,
      }))
      .filter(
        (component): component is { code: string; includedQty: number } =>
          Boolean(component.code) && component.includedQty > 0
      );

    normalizedComponents.forEach((component) => {
      if (remainingDemandUnits <= 0) {
        return;
      }

      const remainingQty =
        remainingSellableQtyByProduct.get(component.code) || 0;
      if (remainingQty <= 0) {
        return;
      }

      const maxDemandUnitsFromComponent = Math.floor(
        remainingQty / component.includedQty
      );
      if (maxDemandUnitsFromComponent <= 0) {
        return;
      }

      const allocatedDemandUnits = Math.min(
        maxDemandUnitsFromComponent,
        remainingDemandUnits
      );
      const allocatedQty = allocatedDemandUnits * component.includedQty;

      const currentAllocatedQty =
        allocatedQtyByProduct.get(component.code) || 0;
      allocatedQtyByProduct.set(
        component.code,
        currentAllocatedQty + allocatedQty
      );
      remainingSellableQtyByProduct.set(
        component.code,
        remainingQty - allocatedQty
      );

      remainingDemandUnits -= allocatedDemandUnits;
    });
  };

  const normalizedMixSkus = new Set(
    mixAndMatchBatches
      .map((batch) => normalizeProductCode(batch.mixAndMatchSku))
      .filter((value): value is string => Boolean(value))
  );

  normalizedMixSkus.forEach((normalizedMixSku) => {
    allocateMixDemandToComponents(
      normalizedMixSku,
      soldQtyByProduct,
      mixSoldQtyByProduct
    );
    allocateMixDemandToComponents(
      normalizedMixSku,
      committedQtyByProduct,
      mixReservedQtyByProduct
    );
  });

  return products.map((product) => {
    const productCode = product['Product Code'] || '';
    const normalizedProductCode = normalizeProductCode(productCode);
    const quantity = product.Quantity || 0;
    const committedQty =
      (committedQtyByProduct.get(normalizedProductCode) || 0) +
      (mixReservedQtyByProduct.get(normalizedProductCode) || 0);
    const damagedOnHand = damagedDeltaByProduct.get(normalizedProductCode) || 0;
    const manualSupplierShortQty =
      supplierShortDeltaByProduct.get(normalizedProductCode) || 0;
    const soldQty =
      (soldQtyByProduct.get(normalizedProductCode) || 0) +
      (mixSoldQtyByProduct.get(normalizedProductCode) || 0);
    const scrapQty = scrapQtyByProduct.get(normalizedProductCode) || 0;
    const additionalsQty = Math.max(
      additionalsQtyByProduct.get(normalizedProductCode) || 0,
      0
    );
    const transferSellableDelta =
      transferSellableDeltaByProduct.get(normalizedProductCode) || 0;
    const actualQuantityReceived =
      actualQuantityByProduct.get(normalizedProductCode) ??
      Math.max(
        quantity + additionalsQty - manualSupplierShortQty - damagedOnHand,
        0
      );
    const sellableOnHand = Math.max(
      actualQuantityReceived - committedQty - soldQty + transferSellableDelta,
      0
    );
    const reservedOnHand = Math.max(committedQty, 0);
    const totalSales = totalSalesByProduct.get(normalizedProductCode) || 0;
    const cogs = product.COGS || 0;
    const actualPrice = product['Actual Price'] || 0;
    const shipmentStatus = product['Shipment Status'] || '';
    const onHandSellable = sellableOnHand;
    const onHandReserved = reservedOnHand;
    const inTransitReserved = 0;
    const inTransitUnreserved = 0;

    const onhand = actualQuantityReceived;
    const availableStock = sellableOnHand;
    const supplierShortQty = manualSupplierShortQty;
    const netProfit = totalSales - cogs;
    const percentage = cogs !== 0 ? netProfit / cogs : 0;
    const endingInventoryValue = availableStock * actualPrice;

    return {
      id: product.id,
      productCode,
      quantity,
      actualQuantityReceived,
      sellableOnHand,
      reservedOnHand,
      onHandSellable,
      onHandReserved,
      inTransitUnreserved,
      inTransitReserved,
      soldQty,
      damagedOnHand,
      scrapQty,
      additionalsQty,
      onhand,
      availableStock,
      supplierShortQty,
      totalSales,
      cogs,
      netProfit,
      percentage,
      endingInventoryValue,
      shipmentCode: product['Shipment Code'] || '',
      shipmentStatus,
    };
  });
}

export function filterInventoryData(
  data: InventoryItem[],
  searchQuery: string
): InventoryItem[] {
  if (!searchQuery.trim()) {
    return data;
  }

  const query = searchQuery.trim().toLowerCase();

  return data.filter((item) => {
    const searchableValues = [
      item.productCode,
      item.shipmentCode,
      item.shipmentStatus,
      item.soldQty,
      item.quantity,
      item.onhand,
      item.damagedOnHand,
      item.availableStock,
      item.actualQuantityReceived,
      item.supplierShortQty,
      item.additionalsQty,
      item.totalSales,
      item.cogs,
      item.netProfit,
      item.percentage,
      item.endingInventoryValue,
    ]
      .map((value) =>
        typeof value === 'number' ? value.toString() : (value?.toString() ?? '')
      )
      .join(' ')
      .toLowerCase();

    return searchableValues.includes(query);
  });
}

export function calculateTotals(data: InventoryItem[]): InventoryTotals {
  return data.reduce<InventoryTotals>(
    (acc, item) => ({
      quantity: acc.quantity + item.quantity,
      onhand: acc.onhand + item.onhand,
      onHandSellable: acc.onHandSellable + item.onHandSellable,
      onHandReserved: acc.onHandReserved + item.onHandReserved,
      inTransitUnreserved: acc.inTransitUnreserved + item.inTransitUnreserved,
      inTransitReserved: acc.inTransitReserved + item.inTransitReserved,
      damagedOnHand: acc.damagedOnHand + item.damagedOnHand,
      availableStock: acc.availableStock + item.availableStock,
      supplierShortQty: acc.supplierShortQty + item.supplierShortQty,
      totalSales: acc.totalSales + item.totalSales,
      cogs: acc.cogs + item.cogs,
      netProfit: acc.netProfit + item.netProfit,
      endingInventoryValue:
        acc.endingInventoryValue + item.endingInventoryValue,
    }),
    {
      quantity: 0,
      onhand: 0,
      onHandSellable: 0,
      onHandReserved: 0,
      inTransitUnreserved: 0,
      inTransitReserved: 0,
      damagedOnHand: 0,
      availableStock: 0,
      supplierShortQty: 0,
      totalSales: 0,
      cogs: 0,
      netProfit: 0,
      endingInventoryValue: 0,
    }
  );
}
