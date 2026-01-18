import { describe, expect, it } from 'vitest';
import { buildInventoryItems } from '../inventoryTransforms';
import type {
  InventoryMovementFromAPI,
  ProductFromAPI,
  TransactionFromAPI,
} from '../../types';

describe('buildInventoryItems', () => {
  it('derives available stock from sellable bucket movements (and does not surface reserved qty)', () => {
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
        'Product Code': 'ABC-1',
        Quantity: 2,
        'Unit Price': 10,
        'Order Status': 'Ready For Dispatch',
      },
    ];

    const movements: InventoryMovementFromAPI[] = [
      {
        id: 1,
        productCode: 'ABC-1',
        quantity: 10,
        fromBucket: 'scrap',
        toBucket: 'sellable',
      },
      {
        id: 2,
        productCode: 'ABC-1',
        quantity: 2,
        fromBucket: 'sellable',
        toBucket: 'reserved',
      },
    ];

    const items = buildInventoryItems(products, transactions, [], movements);

    const abc = items.find((i) => i.productCode === 'ABC-1');
    expect(abc).toBeDefined();

    // sellable: 10 received - 2 moved to reserved = 8
    expect(abc?.sellableOnHand).toBe(8);
    expect(abc?.reservedOnHand).toBe(2);
    expect(abc?.damagedOnHand).toBe(0);
    expect(abc?.scrapQty).toBe(0);
    expect(abc?.onhand).toBe(10);

    // availability is based on sellableOnHand only
    expect(abc?.availableStock).toBe(8);
    expect(abc?.supplierShortQty).toBe(0);

    // revenue counts only fulfilled statuses
    expect(abc?.totalSales).toBe(20);
    expect(abc?.endingInventoryValue).toBe(8 * 5);
  });

  it('falls back to product quantity when no sellable movements exist', () => {
    const products: ProductFromAPI[] = [
      {
        id: 'p1',
        'Product Code': 'XYZ-9',
        Quantity: 7,
        COGS: 0,
        'Actual Price': 2,
        'Shipment Code': 'S1',
        'Shipment Status': 'In Transit',
      },
    ];

    const items = buildInventoryItems(products, [], [], []);
    const xyz = items.find((i) => i.productCode === 'XYZ-9');

    expect(xyz).toBeDefined();
    expect(xyz?.sellableOnHand).toBe(7);
    expect(xyz?.reservedOnHand).toBe(0);
    expect(xyz?.damagedOnHand).toBe(0);
    expect(xyz?.scrapQty).toBe(0);
    expect(xyz?.onhand).toBe(7);
    expect(xyz?.availableStock).toBe(7);
    expect(xyz?.supplierShortQty).toBe(0);
    expect(xyz?.shipmentCode).toBe('S1');
    expect(xyz?.shipmentStatus).toBe('In Transit');
  });

  it('tracks damaged quantity separately and keeps onhand as sellable+reserved', () => {
    const products: ProductFromAPI[] = [
      {
        id: 'p1',
        'Product Code': 'ABC-1',
        Quantity: 100,
        COGS: 0,
        'Actual Price': 5,
        'Shipment Code': null,
        'Shipment Status': null,
      },
    ];

    const movements: InventoryMovementFromAPI[] = [
      {
        id: 1,
        productCode: 'ABC-1',
        quantity: 100,
        fromBucket: 'scrap',
        toBucket: 'sellable',
      },
      {
        id: 2,
        productCode: 'ABC-1',
        quantity: 20,
        fromBucket: 'sellable',
        toBucket: 'damaged_hold',
      },
    ];

    const items = buildInventoryItems(products, [], [], movements);
    const abc = items.find((i) => i.productCode === 'ABC-1');

    expect(abc).toBeDefined();
    expect(abc?.sellableOnHand).toBe(80);
    expect(abc?.reservedOnHand).toBe(0);
    expect(abc?.damagedOnHand).toBe(20);
    expect(abc?.scrapQty).toBe(0);
    expect(abc?.onhand).toBe(80);
    expect(abc?.availableStock).toBe(80);
    expect(abc?.supplierShortQty).toBe(0);
  });

  it('counts scrap as cumulative write-offs (incoming to scrap from non-scrap buckets)', () => {
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
    ];

    const movements: InventoryMovementFromAPI[] = [
      {
        id: 1,
        productCode: 'ABC-1',
        quantity: 10,
        fromBucket: 'scrap',
        toBucket: 'sellable',
      },
      {
        id: 2,
        productCode: 'ABC-1',
        quantity: 3,
        fromBucket: 'sellable',
        toBucket: 'scrap',
      },
    ];

    const items = buildInventoryItems(products, [], [], movements);
    const abc = items.find((i) => i.productCode === 'ABC-1');

    expect(abc).toBeDefined();
    expect(abc?.sellableOnHand).toBe(7);
    expect(abc?.scrapQty).toBe(3);
  });

  it('shows supplier short quantity when expected quantity exceeds received (sellable+reserved+damaged)', () => {
    const products: ProductFromAPI[] = [
      {
        id: 'p1',
        'Product Code': 'XYZ-9',
        Quantity: 100,
        COGS: 0,
        'Actual Price': 2,
        'Shipment Code': 'S1',
        'Shipment Status': 'Delivered',
      },
    ];

    const movements: InventoryMovementFromAPI[] = [
      {
        id: 1,
        productCode: 'XYZ-9',
        quantity: 80,
        fromBucket: 'scrap',
        toBucket: 'sellable',
      },
    ];

    const items = buildInventoryItems(products, [], [], movements);
    const xyz = items.find((i) => i.productCode === 'XYZ-9');

    expect(xyz).toBeDefined();
    expect(xyz?.onhand).toBe(80);
    expect(xyz?.damagedOnHand).toBe(0);
    expect(xyz?.scrapQty).toBe(0);
    expect(xyz?.supplierShortQty).toBe(20);
  });
});
