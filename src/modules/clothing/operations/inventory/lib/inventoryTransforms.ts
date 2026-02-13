import type {
  InventoryItem,
  InventoryTotals,
  ProductFromAPI,
  BundleBatchFromAPI,
  TransactionFromAPI,
  InventoryMovementFromAPI,
} from '../types';
import {
  buildSellableDeltaMap,
  buildReservedDeltaMap,
  buildBucketDeltaMap,
  getSellableOnHand,
  buildSellableReceiptCodeSet,
  normalizeProductCode,
} from '@/lib/inventory/movements';
import { isFulfilledStatus } from '@/lib/inventory/statuses';
import { isInTransitShipmentStatus } from '@/lib/inventory/shipment-status';
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
  movements: InventoryMovementFromAPI[] = []
): InventoryItem[] {
  // `supplier_short` entries are informational (shortfalls on a PO), not physical stock.
  // They must not reduce SELLABLE on-hand or availability.
  // We only surface supplier short qty when explicitly recorded via movements.
  const movementsForStockBalances = movements.filter(
    (movement) => movement.toBucket !== 'supplier_short'
  );

  const sellableDeltaByProduct = buildSellableDeltaMap(
    movementsForStockBalances
  );
  const reservedDeltaByProduct = buildReservedDeltaMap(
    movementsForStockBalances
  );
  const damagedDeltaByProduct = buildBucketDeltaMap(
    movementsForStockBalances,
    'damaged_hold'
  );
  const sellableReceiptCodes = buildSellableReceiptCodeSet(
    movementsForStockBalances
  );
  const supplierShortDeltaByProduct = buildBucketDeltaMap(
    movements,
    'supplier_short'
  );
  const scrapQtyByProduct = new Map<string, number>();
  const totalSalesByProduct = new Map<string, number>();

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

    const fulfilledStatus = isFulfilledStatus(orderStatus);
    const shouldCountAsRevenue = fulfilledStatus;

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

    if (movement.toBucket !== 'scrap' || movement.fromBucket === 'scrap') {
      return;
    }

    const qty = movement.quantity ?? 0;
    const current = scrapQtyByProduct.get(normalizedProductCode) ?? 0;
    scrapQtyByProduct.set(normalizedProductCode, current + qty);
  });

  return products.map((product) => {
    const productCode = product['Product Code'] || '';
    const normalizedProductCode = normalizeProductCode(productCode);
    const quantity = product.Quantity || 0;
    const sellableOnHand = getSellableOnHand({
      productCode,
      sellableDeltaByProduct,
      fallbackQuantity: quantity,
      sellableReceiptCodes,
    });
    const reservedOnHand =
      reservedDeltaByProduct.get(normalizedProductCode) || 0;
    const damagedOnHand = damagedDeltaByProduct.get(normalizedProductCode) || 0;
    const manualSupplierShortQty =
      supplierShortDeltaByProduct.get(normalizedProductCode) || 0;
    const scrapQty = scrapQtyByProduct.get(normalizedProductCode) || 0;
    const totalSales = totalSalesByProduct.get(normalizedProductCode) || 0;
    const cogs = product.COGS || 0;
    const actualPrice = product['Actual Price'] || 0;
    const shipmentStatus = product['Shipment Status'] || '';
    const isInTransit = isInTransitShipmentStatus(shipmentStatus);

    // In-transit rows should reflect movement-adjusted availability.
    // This ensures allocations like bundle assembly (sellable -> assembly_wip)
    // reduce in-transit unreserved quantity and avoid oversell.
    const clampedReservedForTransit = Math.max(reservedOnHand, 0);
    const clampedSellableForTransit = Math.max(sellableOnHand, 0);

    // In-transit quantities are reported separately from physical on-hand.
    const onHandSellable = isInTransit ? 0 : sellableOnHand;
    const onHandReserved = isInTransit ? 0 : reservedOnHand;
    const inTransitReserved = isInTransit ? clampedReservedForTransit : 0;
    const inTransitUnreserved = isInTransit ? clampedSellableForTransit : 0;

    const onhand = onHandSellable + onHandReserved;
    const availableStock = onHandSellable;
    const supplierShortQty = manualSupplierShortQty;
    const actualQuantityReceived = Math.max(
      quantity - supplierShortQty - scrapQty,
      0
    );
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
      damagedOnHand,
      scrapQty,
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
      item.quantity,
      item.onhand,
      item.damagedOnHand,
      item.availableStock,
      item.actualQuantityReceived,
      item.supplierShortQty,
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
