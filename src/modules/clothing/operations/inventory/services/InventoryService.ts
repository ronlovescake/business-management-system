/**
 * Inventory Service
 *
 * Bridges the products module data with the inventory UI requirements.
 */

import { ProductService } from '@/modules/clothing/operations/products/services/ProductService';
import type { InventoryRecord } from '../types';

export class InventoryService {
  /**
   * Loads inventory records by reusing the products module dataset.
   */
  static async loadInventoryRecords(): Promise<InventoryRecord[]> {
    const products = await ProductService.loadProducts();

    return products.map((product, index) => {
      const productCode = product['Product Code']?.trim() ?? '';
      const fallbackId =
        productCode || product['Shipment Code'] || `inventory-${index}`;

      return {
        id: String(product.id ?? fallbackId ?? index),
        productCode,
        quantity: Number(product.Quantity ?? 0),
        shipmentCode: product['Shipment Code']?.trim() ?? '',
        shipmentStatus: product['Shipment Status']?.trim() ?? '',
      };
    });
  }
}
