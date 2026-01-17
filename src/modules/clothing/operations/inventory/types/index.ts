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

export interface BundleComponentFromAPI {
  componentProductCode: string;
  includedQuantity: number;
}

export interface BundleBatchFromAPI {
  id: number;
  postingDate: string;
  bundleName: string;
  bundleSku: string;
  quantity: number;
  price: number;
  components: BundleComponentFromAPI[];
}

export type InventoryBucket =
  | 'sellable'
  | 'damaged_hold'
  | 'reserved'
  | 'assembly_wip'
  | 'scrap'
  | 'sold';

export interface InventoryMovementFromAPI {
  id: number;
  productCode: string;
  quantity: number;
  fromBucket: InventoryBucket;
  toBucket: InventoryBucket;
  postingDate?: string | null;
  notes?: string | null;
  createdAt?: string;
}

export interface InventoryItem {
  id: string;
  productCode: string;
  quantity: number;
  sellableOnHand: number;
  reservedOnHand: number;
  damagedOnHand: number;
  onhand: number;
  availableStock: number;
  supplierShortQty: number;
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
  damagedOnHand: number;
  availableStock: number;
  supplierShortQty: number;
  totalSales: number;
  cogs: number;
  netProfit: number;
  endingInventoryValue: number;
}
