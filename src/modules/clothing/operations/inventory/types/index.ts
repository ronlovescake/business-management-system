export interface ProductFromAPI {
  id: string;
  'Product Code': string | null;
  Quantity: number;
  COGS: number;
  'Actual Price': number;
  'Shipment Code': string | null;
  'Shipment Status': string | null;
}

export interface TransactionFromAPI {
  id: string;
  'Product Code': string | null;
  Quantity: number;
  'Unit Price': number;
  'Order Status': string | null;
}

export interface InventoryItem {
  id: string;
  productCode: string;
  quantity: number;
  onhand: number;
  totalOrder: number;
  availableStock: number;
  totalSales: number;
  cogs: number;
  netProfit: number;
  percentage: number;
  endingInventoryValue: number;
  shipmentCode: string;
  shipmentStatus: string;
}

export interface InventoryTotals {
  quantity: number;
  onhand: number;
  totalOrder: number;
  availableStock: number;
  totalSales: number;
  cogs: number;
  netProfit: number;
  endingInventoryValue: number;
}
