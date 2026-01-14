import { describe, expect, it } from 'vitest';
import { buildInventoryItems } from '../inventoryTransforms';
import type {
  BundleBatchFromAPI,
  InventoryMovementFromAPI,
  ProductFromAPI,
  TransactionFromAPI,
} from '../../types';

describe('buildInventoryItems', () => {
  it('uses reserved bucket movements for reserved qty when present (fallback to legacy transaction-derived reservations otherwise)', () => {
    const products: ProductFromAPI[] = [
      {
        id: 'p1',
        'Product Code': 'ABC-1',
        Quantity: 10,
        COGS: 0,
        'Actual Price': 5,
        'Shipment Code': null,
        'Shipment Status': null,
      },
      {
        id: 'p2',
        'Product Code': 'XYZ-9',
        Quantity: 7,
        COGS: 0,
        'Actual Price': 2,
        'Shipment Code': null,
        'Shipment Status': null,
      },
    ];

    const transactions: TransactionFromAPI[] = [
      {
        id: 't1',
        'Product Code': 'ABC-1',
        Quantity: 4,
        'Unit Price': 10,
        'Order Status': 'Warehouse',
      },
      {
        id: 't2',
        'Product Code': 'XYZ-9',
        Quantity: 3,
        'Unit Price': 12,
        'Order Status': 'Warehouse',
      },
    ];

    const movements: InventoryMovementFromAPI[] = [
      // Receipt/backfill creates a sellable delta for ABC-1
      {
        id: 1,
        productCode: 'ABC-1',
        quantity: 10,
        fromBucket: 'scrap',
        toBucket: 'sellable',
      },
      // Reserved movements exist for ABC-1, so reserved qty should come from movement deltas (2), not legacy (4)
      {
        id: 2,
        productCode: 'ABC-1',
        quantity: 2,
        fromBucket: 'sellable',
        toBucket: 'reserved',
      },
      // No reserved movements exist for XYZ-9, so it should fall back to legacy transaction-derived reservations (3)
      {
        id: 3,
        productCode: 'XYZ-9',
        quantity: 7,
        fromBucket: 'scrap',
        toBucket: 'sellable',
      },
    ];

    const items = buildInventoryItems(products, transactions, [], movements);

    const abc = items.find((i) => i.productCode === 'ABC-1');
    const xyz = items.find((i) => i.productCode === 'XYZ-9');

    expect(abc).toBeDefined();
    expect(abc?.onhand).toBe(10);
    expect(abc?.totalOrder).toBe(2);
    expect(abc?.availableStock).toBe(6);

    expect(xyz).toBeDefined();
    expect(xyz?.onhand).toBe(7);
    expect(xyz?.totalOrder).toBe(3);
    expect(xyz?.availableStock).toBe(4);
  });

  it('counts bundle reservations against component SKUs (and nets against reserved bucket movements)', () => {
    const products: ProductFromAPI[] = [
      {
        id: 'p1',
        'Product Code': 'COMP-1',
        Quantity: 0,
        COGS: 0,
        'Actual Price': 5,
        'Shipment Code': null,
        'Shipment Status': null,
      },
    ];

    const bundles: BundleBatchFromAPI[] = [
      {
        id: 1,
        postingDate: '2026-01-01',
        bundleName: 'Bundle',
        bundleSku: 'BUNDLE-1',
        quantity: 1,
        price: 0,
        components: [
          {
            componentProductCode: 'COMP-1',
            includedQuantity: 2,
          },
        ],
      },
    ];

    const transactions: TransactionFromAPI[] = [
      {
        id: 't1',
        'Product Code': 'BUNDLE-1',
        Quantity: 3,
        'Unit Price': 0,
        'Order Status': 'Warehouse',
      },
    ];

    const movements: InventoryMovementFromAPI[] = [
      // 10 sellable units for component
      {
        id: 1,
        productCode: 'COMP-1',
        quantity: 10,
        fromBucket: 'scrap',
        toBucket: 'sellable',
      },
      // 2 units already moved to reserved bucket
      {
        id: 2,
        productCode: 'COMP-1',
        quantity: 2,
        fromBucket: 'sellable',
        toBucket: 'reserved',
      },
    ];

    const items = buildInventoryItems(
      products,
      transactions,
      bundles,
      movements
    );
    const comp = items.find((i) => i.productCode === 'COMP-1');

    // Bundle demand: 3 bundles * 2 units = 6 demand.
    // Reserved on-hand: 2 (movement).
    // Reserved qty remaining: 6 - 2 = 4.
    // Sellable on-hand: 10 - 2 = 8 (movement delta).
    // Physical onhand: sellable + reservedOnHand = 8 + 2 = 10.
    // Available: sellable - remaining reserved qty = 8 - 4 = 4.
    expect(comp).toBeDefined();
    expect(comp?.onhand).toBe(10);
    expect(comp?.totalOrder).toBe(4);
    expect(comp?.availableStock).toBe(4);
  });

  it('aggregates reservations from multiple bundles that share a component SKU', () => {
    const products: ProductFromAPI[] = [
      {
        id: 'p1',
        'Product Code': 'COMP-1',
        Quantity: 0,
        COGS: 0,
        'Actual Price': 5,
        'Shipment Code': null,
        'Shipment Status': null,
      },
    ];

    const bundles: BundleBatchFromAPI[] = [
      {
        id: 1,
        postingDate: '2026-01-01',
        bundleName: 'Bundle A',
        bundleSku: 'BUNDLE-A',
        quantity: 1,
        price: 0,
        components: [
          {
            componentProductCode: 'COMP-1',
            includedQuantity: 2,
          },
        ],
      },
      {
        id: 2,
        postingDate: '2026-01-01',
        bundleName: 'Bundle B',
        bundleSku: 'BUNDLE-B',
        quantity: 1,
        price: 0,
        components: [
          {
            componentProductCode: 'COMP-1',
            includedQuantity: 3,
          },
        ],
      },
    ];

    const transactions: TransactionFromAPI[] = [
      {
        id: 't1',
        'Product Code': 'BUNDLE-A',
        Quantity: 2,
        'Unit Price': 0,
        'Order Status': 'Warehouse',
      },
      {
        id: 't2',
        'Product Code': 'BUNDLE-B',
        Quantity: 1,
        'Unit Price': 0,
        'Order Status': 'Warehouse',
      },
    ];

    const movements: InventoryMovementFromAPI[] = [
      {
        id: 1,
        productCode: 'COMP-1',
        quantity: 10,
        fromBucket: 'scrap',
        toBucket: 'sellable',
      },
      {
        id: 2,
        productCode: 'COMP-1',
        quantity: 1,
        fromBucket: 'sellable',
        toBucket: 'reserved',
      },
    ];

    const items = buildInventoryItems(
      products,
      transactions,
      bundles,
      movements
    );
    const comp = items.find((i) => i.productCode === 'COMP-1');

    // Demand: (2 * 2) + (1 * 3) = 7
    // Reserved on-hand: 1
    // Reserved remaining: 7 - 1 = 6
    // Sellable on-hand: 10 - 1 = 9
    // Physical onhand: 9 + 1 = 10
    // Available: 9 - 6 = 3
    expect(comp).toBeDefined();
    expect(comp?.onhand).toBe(10);
    expect(comp?.totalOrder).toBe(6);
    expect(comp?.availableStock).toBe(3);
  });

  it('uses assembled bundle sellable on-hand first, and only reserves components for overflow bundles', () => {
    const products: ProductFromAPI[] = [
      {
        id: 'p1',
        'Product Code': 'COMP-1',
        Quantity: 0,
        COGS: 0,
        'Actual Price': 5,
        'Shipment Code': null,
        'Shipment Status': null,
      },
      {
        id: 'p2',
        'Product Code': 'BUNDLE-1',
        Quantity: 0,
        COGS: 0,
        'Actual Price': 0,
        'Shipment Code': null,
        'Shipment Status': null,
      },
    ];

    const bundles: BundleBatchFromAPI[] = [
      {
        id: 1,
        postingDate: '2026-01-01',
        bundleName: 'Bundle',
        bundleSku: 'BUNDLE-1',
        quantity: 1,
        price: 0,
        components: [
          {
            componentProductCode: 'COMP-1',
            includedQuantity: 2,
          },
        ],
      },
    ];

    const transactions: TransactionFromAPI[] = [
      {
        id: 't1',
        'Product Code': 'BUNDLE-1',
        Quantity: 3,
        'Unit Price': 0,
        'Order Status': 'Warehouse',
      },
    ];

    const movements: InventoryMovementFromAPI[] = [
      // Component has 10 sellable units
      {
        id: 1,
        productCode: 'COMP-1',
        quantity: 10,
        fromBucket: 'scrap',
        toBucket: 'sellable',
      },
      // Bundle SKU has 2 assembled units on-hand
      {
        id: 2,
        productCode: 'BUNDLE-1',
        quantity: 2,
        fromBucket: 'scrap',
        toBucket: 'sellable',
      },
    ];

    const items = buildInventoryItems(
      products,
      transactions,
      bundles,
      movements
    );
    const comp = items.find((i) => i.productCode === 'COMP-1');
    const bundle = items.find((i) => i.productCode === 'BUNDLE-1');

    // Bundle demand is 3. Two bundles are already assembled, so only 1 bundle overflows to components.
    // Component demand from this bundle: 1 * 2 = 2.
    expect(comp).toBeDefined();
    expect(comp?.totalOrder).toBe(2);
    expect(comp?.availableStock).toBe(8);

    // Bundle SKU itself is reserved for all 3 bundles; availability uses its own sellable on-hand.
    expect(bundle).toBeDefined();
    expect(bundle?.sellableOnHand).toBe(2);
    expect(bundle?.totalOrder).toBe(3);
    expect(bundle?.availableStock).toBe(-1);
  });
});
