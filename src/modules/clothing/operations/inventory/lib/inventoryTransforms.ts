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
  getSellableOnHand,
  normalizeProductCode,
} from '@/lib/inventory/movements';
import { isFulfilledStatus, isReservedStatus } from '@/lib/inventory/statuses';

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
  const sellableDeltaByProduct = buildSellableDeltaMap(movements);
  const reservedDeltaByProduct = buildReservedDeltaMap(movements);

  const totalOrderByProduct = new Map<string, number>();
  const totalSalesByProduct = new Map<string, number>();

  const bundleComponentsBySku = new Map<
    string,
    { componentProductCode: string; includedQuantity: number }[]
  >();

  bundles.forEach((bundle) => {
    const normalizedSku = normalizeProductCode(bundle.bundleSku);
    if (!normalizedSku) {
      return;
    }

    const components = (bundle.components || []).filter(
      (component) =>
        Boolean(normalizeProductCode(component.componentProductCode)) &&
        Number.isFinite(component.includedQuantity) &&
        component.includedQuantity > 0
    );

    bundleComponentsBySku.set(normalizedSku, components);
  });

  transactions.forEach((transaction) => {
    const productCode = transaction['Product Code'];
    const orderStatus = transaction['Order Status'];
    const quantity = transaction.Quantity || 0;
    const unitPrice = transaction['Unit Price'] || 0;
    const normalizedProductCode = normalizeProductCode(productCode);

    const isCancelled = normalizeProductCode(orderStatus) === 'cancelled';
    if (isCancelled || !normalizedProductCode) {
      return;
    }

    const reservedStatus = isReservedStatus(orderStatus);
    const fulfilledStatus = isFulfilledStatus(orderStatus);
    const shouldCountAsReserved = reservedStatus;
    const shouldCountAsRevenue = fulfilledStatus;

    const bundleComponents = bundleComponentsBySku.get(normalizedProductCode);

    if (bundleComponents?.length) {
      if (!shouldCountAsReserved) {
        return;
      }

      bundleComponents.forEach((component) => {
        const componentCode = normalizeProductCode(
          component.componentProductCode
        );

        if (!componentCode) {
          return;
        }

        const currentTotalOrder = totalOrderByProduct.get(componentCode) || 0;
        totalOrderByProduct.set(
          componentCode,
          currentTotalOrder + quantity * component.includedQuantity
        );
      });

      return;
    }

    if (shouldCountAsReserved) {
      const currentTotalOrder =
        totalOrderByProduct.get(normalizedProductCode) || 0;
      totalOrderByProduct.set(
        normalizedProductCode,
        currentTotalOrder + quantity
      );
    }

    if (shouldCountAsRevenue) {
      const currentTotalSales =
        totalSalesByProduct.get(normalizedProductCode) || 0;
      totalSalesByProduct.set(
        normalizedProductCode,
        currentTotalSales + unitPrice * quantity
      );
    }
  });

  return products.map((product) => {
    const productCode = product['Product Code'] || '';
    const normalizedProductCode = normalizeProductCode(productCode);
    const quantity = product.Quantity || 0;
    const sellableOnHand = getSellableOnHand({
      productCode,
      sellableDeltaByProduct,
      fallbackQuantity: quantity,
    });
    const demandRaw = totalOrderByProduct.get(normalizedProductCode) || 0;
    const reservedOnHand =
      reservedDeltaByProduct.get(normalizedProductCode) || 0;
    const reservedQty = Math.max(demandRaw - reservedOnHand, 0);
    const totalSales = totalSalesByProduct.get(normalizedProductCode) || 0;
    const cogs = product.COGS || 0;
    const actualPrice = product['Actual Price'] || 0;
    const onhand = sellableOnHand + reservedOnHand;
    const availableStock = sellableOnHand - reservedQty;
    const netProfit = totalSales - cogs;
    const percentage = cogs !== 0 ? netProfit / cogs : 0;
    const endingInventoryValue = availableStock * actualPrice;

    return {
      id: product.id,
      productCode,
      quantity,
      onhand,
      totalOrder: reservedQty,
      availableStock,
      totalSales,
      cogs,
      netProfit,
      percentage,
      endingInventoryValue,
      shipmentCode: product['Shipment Code'] || '',
      shipmentStatus: product['Shipment Status'] || '',
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
      item.totalOrder,
      item.availableStock,
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
      totalOrder: acc.totalOrder + item.totalOrder,
      availableStock: acc.availableStock + item.availableStock,
      totalSales: acc.totalSales + item.totalSales,
      cogs: acc.cogs + item.cogs,
      netProfit: acc.netProfit + item.netProfit,
      endingInventoryValue:
        acc.endingInventoryValue + item.endingInventoryValue,
    }),
    {
      quantity: 0,
      onhand: 0,
      totalOrder: 0,
      availableStock: 0,
      totalSales: 0,
      cogs: 0,
      netProfit: 0,
      endingInventoryValue: 0,
    }
  );
}
