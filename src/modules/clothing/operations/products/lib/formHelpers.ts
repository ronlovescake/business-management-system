import type { ProductFromAPI } from '@/modules/clothing/operations/inventory/types';
import type { ProductData } from '../types/product.types';

export function createClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function toInventoryProduct(product: ProductData): ProductFromAPI {
  return {
    id: String(product.id ?? ''),
    'Product Code': product['Product Code'] ?? null,
    Quantity: Number(product.Quantity ?? 0),
    COGS: Number(product.COGS ?? 0),
    'Actual Price': Number(product['Actual Price'] ?? 0),
    'Shipment Code': product['Shipment Code'] ?? null,
    'Shipment Status': product['Shipment Status'] ?? null,
  };
}
