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

export interface MixAndMatchComponentFromAPI {
  id?: number;
  productCode: string;
  includedQuantity: number;
}

export interface MixAndMatchBatchFromAPI {
  id: number;
  postingDate: string;
  mixAndMatchName: string;
  mixAndMatchSku: string;
  price: number;
  components: MixAndMatchComponentFromAPI[];
}

export interface SplitComponentFromAPI {
  id?: number;
  componentLabel: string;
  componentSku: string;
  componentPrice: number;
  includedQuantity: number;
}

export interface SplitBatchFromAPI {
  id: number;
  postingDate: string;
  splitName: string;
  splitSku: string;
  components: SplitComponentFromAPI[];
}

export type InventoryBucket =
  | 'sellable'
  | 'damaged_hold'
  | 'reserved'
  | 'assembly_wip'
  | 'scrap'
  | 'supplier_short'
  | 'opening_inventory'
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
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface InventoryItem {
  id: string;
  productCode: string;
  quantity: number;
  actualQuantityReceived: number;
  sellableOnHand: number;
  reservedOnHand: number;
  // Split view (derived from shipment status)
  onHandSellable: number;
  onHandReserved: number;
  inTransitUnreserved: number;
  inTransitReserved: number;
  soldQty: number;
  damagedOnHand: number;
  scrapQty: number;
  additionalsQty: number;
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
  onHandSellable: number;
  onHandReserved: number;
  inTransitUnreserved: number;
  inTransitReserved: number;
  damagedOnHand: number;
  availableStock: number;
  supplierShortQty: number;
  totalSales: number;
  cogs: number;
  netProfit: number;
  endingInventoryValue: number;
}
