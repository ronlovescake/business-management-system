import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { normalizeProductCode } from '@/lib/inventory/movements';
import { useInventoryViewModel } from '../useInventoryViewModel';
import type {
  InventoryItem,
  InventoryMovementFromAPI,
  ProductFromAPI,
} from '../../types';

const productCode = 'Premium Footed Pants (PFP-012426)';
const transferDestination = 'Destination SKU';

const inventoryItem: InventoryItem = {
  id: '1',
  productCode,
  quantity: 100,
  actualQuantityReceived: 100,
  sellableOnHand: 90,
  reservedOnHand: 0,
  onHandSellable: 90,
  onHandReserved: 0,
  inTransitUnreserved: 0,
  inTransitReserved: 0,
  soldQty: 0,
  damagedOnHand: 10,
  scrapQty: 0,
  additionalsQty: 0,
  onhand: 100,
  availableStock: 90,
  supplierShortQty: 0,
  totalSales: 0,
  cogs: 0,
  netProfit: 0,
  percentage: 0,
  endingInventoryValue: 0,
  shipmentCode: '',
  shipmentStatus: '',
};

const products: ProductFromAPI[] = [
  {
    id: '1',
    'Product Code': productCode,
    Quantity: 100,
    COGS: 0,
    'Actual Price': 0,
    'Shipment Code': null,
    'Shipment Status': null,
  },
  {
    id: '2',
    'Product Code': transferDestination,
    Quantity: 50,
    COGS: 0,
    'Actual Price': 0,
    'Shipment Code': null,
    'Shipment Status': null,
  },
];

const movements: InventoryMovementFromAPI[] = [
  {
    id: 101,
    productCode,
    quantity: 10,
    fromBucket: 'sellable',
    toBucket: 'damaged_hold',
    postingDate: '2026-02-17',
    notes: 'existing note',
  },
  {
    id: 102,
    productCode,
    quantity: 2,
    fromBucket: 'sellable',
    toBucket: 'supplier_short',
    postingDate: '2026-02-18',
    notes: `transfer: from: ${productCode}; to: ${transferDestination}`,
  },
];

describe('useInventoryViewModel', () => {
  it('groups inventory display, movement summaries, and adjustment preview data', () => {
    const getSellableOnHand = vi.fn().mockReturnValue(90);

    const { result } = renderHook(() =>
      useInventoryViewModel({
        filteredData: [inventoryItem],
        emptyStateMessage: 'No inventory records yet.',
        searchQuery: '',
        sellableFilter: 'non_zero_sellable',
        products,
        movements,
        selectedProduct: productCode,
        transferToProduct: transferDestination,
        transferQty: 2,
        bucketQuantities: {
          damaged_hold: 10,
          scrap: 0,
          supplier_short: 0,
          additionals: 0,
        },
        editingProductCode: productCode,
        editingMovementId: 101,
        additionalsNotePrefix: 'additionals',
        transferNotePrefix: 'transfer',
        transferNoteMarker: 'transfer:',
        getSellableOnHand,
        normalizeProductCode,
      })
    );

    expect(result.current.sortedFilteredData).toHaveLength(1);
    expect(result.current.displayedTotals.damagedOnHand).toBe(10);
    expect(
      result.current.adjustmentNotesByProduct.get(
        normalizeProductCode(productCode)
      )
    ).toBe('existing note');
    expect(
      result.current.transferOutByProduct.quantityByProduct.get(
        normalizeProductCode(productCode)
      )
    ).toBe(2);
    expect(result.current.editingMovement?.id).toBe(101);
    expect(result.current.productOptions).toEqual([
      { value: productCode, label: productCode },
      { value: transferDestination, label: transferDestination },
    ]);
    expect(result.current.transferToOptions).toEqual([
      { value: transferDestination, label: transferDestination },
    ]);
    expect(
      result.current.adjustmentSellablePreview.projectedSellableOnHand
    ).toBe(90);
  });
});
