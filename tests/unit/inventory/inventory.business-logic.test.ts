/**
 * Inventory Business Logic Tests
 *
 * Tests derived from docs/business-logic/clothing/operations-inventory.md
 * Covers: extractApiData, filterInventoryData, calculateTotals.
 */

import { describe, it, expect } from 'vitest';
import {
  extractApiData,
  filterInventoryData,
  calculateTotals,
} from '@/modules/clothing/operations/inventory/lib/inventoryTransforms';
import type { InventoryItem } from '@/modules/clothing/operations/inventory/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeItem = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  id: 'item-1',
  productCode: 'TST-001',
  quantity: 10,
  actualQuantityReceived: 10,
  sellableOnHand: 10,
  reservedOnHand: 0,
  onHandSellable: 10,
  onHandReserved: 0,
  inTransitUnreserved: 0,
  inTransitReserved: 0,
  soldQty: 0,
  damagedOnHand: 0,
  scrapQty: 0,
  additionalsQty: 0,
  onhand: 10,
  availableStock: 10,
  supplierShortQty: 0,
  totalSales: 0,
  cogs: 0,
  netProfit: 0,
  percentage: 0,
  endingInventoryValue: 0,
  shipmentCode: 'SHP-001',
  shipmentStatus: 'Delivered',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Section A — extractApiData
// ---------------------------------------------------------------------------

describe('Inventory — extractApiData', () => {
  it('returns payload directly when it is an array', () => {
    const payload = [{ id: 1 }, { id: 2 }];
    expect(extractApiData(payload)).toEqual(payload);
  });

  it('extracts .data array from wrapped object', () => {
    const payload = { data: [{ id: 1 }] };
    expect(extractApiData(payload)).toEqual([{ id: 1 }]);
  });

  it('returns empty array for null/undefined payload', () => {
    expect(extractApiData(null)).toEqual([]);
    expect(extractApiData(undefined)).toEqual([]);
  });

  it('returns empty array for non-array, non-wrapped object', () => {
    expect(extractApiData({ foo: 'bar' })).toEqual([]);
    expect(extractApiData('')).toEqual([]);
    expect(extractApiData(42)).toEqual([]);
  });

  it('returns empty array when .data exists but is not an array', () => {
    expect(extractApiData({ data: 'not-array' })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Section B — filterInventoryData
// ---------------------------------------------------------------------------

describe('Inventory — filterInventoryData', () => {
  const items: InventoryItem[] = [
    makeItem({ id: 'a', productCode: 'KTS-001', shipmentCode: 'SHP-100' }),
    makeItem({ id: 'b', productCode: 'BBS-002', shipmentCode: 'SHP-200' }),
    makeItem({ id: 'c', productCode: 'KTS-003', shipmentCode: 'SHP-100' }),
  ];

  it('returns all items when searchQuery is blank', () => {
    expect(filterInventoryData(items, '')).toHaveLength(3);
    expect(filterInventoryData(items, '   ')).toHaveLength(3);
  });

  it('filters by productCode (case-insensitive)', () => {
    const result = filterInventoryData(items, 'kts');
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(expect.arrayContaining(['a', 'c']));
  });

  it('filters by shipmentCode', () => {
    const result = filterInventoryData(items, 'SHP-200');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('returns empty array when no match', () => {
    expect(filterInventoryData(items, 'zzz-999')).toHaveLength(0);
  });

  it('filters by numeric field (e.g. soldQty)', () => {
    const itemsWithSold = [
      makeItem({ id: 'x', soldQty: 42 }),
      makeItem({ id: 'y', soldQty: 7 }),
    ];
    expect(filterInventoryData(itemsWithSold, '42')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Section C — calculateTotals
// ---------------------------------------------------------------------------

describe('Inventory — calculateTotals', () => {
  it('returns zeros for empty array', () => {
    const totals = calculateTotals([]);
    expect(totals.quantity).toBe(0);
    expect(totals.totalSales).toBe(0);
    expect(totals.netProfit).toBe(0);
  });

  it('sums quantity across all items', () => {
    const items = [
      makeItem({ quantity: 5 }),
      makeItem({ quantity: 8 }),
      makeItem({ quantity: 3 }),
    ];
    expect(calculateTotals(items).quantity).toBe(16);
  });

  it('sums onhand', () => {
    const items = [makeItem({ onhand: 4 }), makeItem({ onhand: 6 })];
    expect(calculateTotals(items).onhand).toBe(10);
  });

  it('sums cogs', () => {
    const items = [makeItem({ cogs: 1000 }), makeItem({ cogs: 2000 })];
    expect(calculateTotals(items).cogs).toBe(3000);
  });

  it('sums netProfit', () => {
    const items = [makeItem({ netProfit: 500 }), makeItem({ netProfit: -200 })];
    expect(calculateTotals(items).netProfit).toBe(300);
  });

  it('sums endingInventoryValue', () => {
    const items = [
      makeItem({ endingInventoryValue: 1500 }),
      makeItem({ endingInventoryValue: 500 }),
    ];
    expect(calculateTotals(items).endingInventoryValue).toBe(2000);
  });

  it('sums damagedOnHand', () => {
    const items = [
      makeItem({ damagedOnHand: 2 }),
      makeItem({ damagedOnHand: 3 }),
    ];
    expect(calculateTotals(items).damagedOnHand).toBe(5);
  });

  it('sums availableStock', () => {
    const items = [
      makeItem({ availableStock: 7 }),
      makeItem({ availableStock: 3 }),
    ];
    expect(calculateTotals(items).availableStock).toBe(10);
  });
});
