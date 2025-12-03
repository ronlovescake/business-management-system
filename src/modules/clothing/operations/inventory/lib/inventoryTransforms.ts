import type {
  InventoryItem,
  InventoryTotals,
  ProductFromAPI,
  TransactionFromAPI,
} from '../types';

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
  transactions: TransactionFromAPI[]
): InventoryItem[] {
  const totalOrderByProduct = new Map<string, number>();
  const totalSalesByProduct = new Map<string, number>();

  transactions.forEach((transaction) => {
    const productCode = transaction['Product Code'];
    const orderStatus = transaction['Order Status'];
    const quantity = transaction.Quantity || 0;
    const unitPrice = transaction['Unit Price'] || 0;

    if (productCode && orderStatus !== 'Cancelled') {
      const currentTotalOrder = totalOrderByProduct.get(productCode) || 0;
      totalOrderByProduct.set(productCode, currentTotalOrder + quantity);

      const currentTotalSales = totalSalesByProduct.get(productCode) || 0;
      totalSalesByProduct.set(
        productCode,
        currentTotalSales + unitPrice * quantity
      );
    }
  });

  return products.map((product) => {
    const productCode = product['Product Code'] || '';
    const quantity = product.Quantity || 0;
    const totalOrder = totalOrderByProduct.get(productCode) || 0;
    const totalSales = totalSalesByProduct.get(productCode) || 0;
    const cogs = product.COGS || 0;
    const actualPrice = product['Actual Price'] || 0;
    const availableStock = quantity - totalOrder;
    const netProfit = totalSales - cogs;
    const percentage = cogs !== 0 ? netProfit / cogs : 0;
    const endingInventoryValue = availableStock * actualPrice;

    return {
      id: product.id,
      productCode,
      quantity,
      onhand: 0,
      totalOrder,
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
