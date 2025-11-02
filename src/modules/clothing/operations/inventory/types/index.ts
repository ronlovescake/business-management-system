/**
 * Inventory Module Types
 */

export interface InventoryRecord {
  id: string;
  productCode: string;
  quantity: number;
  shipmentCode: string;
  shipmentStatus: string;
}
