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
        'Shipment Status': 'Delivered',
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
    expect(abc?.onHandSellable).toBe(8);
    expect(abc?.onHandReserved).toBe(2);
    expect(abc?.inTransitUnreserved).toBe(0);
    expect(abc?.inTransitReserved).toBe(0);
    expect(abc?.damagedOnHand).toBe(0);
    expect(abc?.scrapQty).toBe(0);
    expect(abc?.onhand).toBe(10);
    expect(abc?.actualQuantityReceived).toBe(10);

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
    expect(xyz?.onHandSellable).toBe(0);
    expect(xyz?.onHandReserved).toBe(0);
    expect(xyz?.inTransitUnreserved).toBe(7);
    expect(xyz?.inTransitReserved).toBe(0);
    expect(xyz?.damagedOnHand).toBe(0);
    expect(xyz?.scrapQty).toBe(0);
    expect(xyz?.onhand).toBe(0);
    expect(xyz?.availableStock).toBe(0);
    expect(xyz?.supplierShortQty).toBe(0);
    expect(xyz?.actualQuantityReceived).toBe(7);
    expect(xyz?.shipmentCode).toBe('S1');
    expect(xyz?.shipmentStatus).toBe('In Transit');
  });

  it('derives in-transit unreserved from movement-adjusted sellable quantity', () => {
    const products: ProductFromAPI[] = [
      {
        id: 'p1',
        'Product Code': 'GPF-012426',
        Quantity: 2800,
        COGS: 0,
        'Actual Price': 0,
        'Shipment Code': 'S1',
        'Shipment Status': 'In Transit',
      },
    ];

    const movements: InventoryMovementFromAPI[] = [
      // Receipt ledger into sellable (would otherwise override fallbackQuantity).
      {
        id: 1,
        productCode: 'GPF-012426',
        quantity: 296,
        fromBucket: 'scrap',
        toBucket: 'sellable',
      },
      // Reservations against incoming shipment.
      {
        id: 2,
        productCode: 'GPF-012426',
        quantity: 1230,
        fromBucket: 'scrap',
        toBucket: 'reserved',
      },
    ];

    const items = buildInventoryItems(products, [], [], movements);
    const gpf = items.find((i) => i.productCode === 'GPF-012426');

    expect(gpf).toBeDefined();
    expect(gpf?.onHandSellable).toBe(0);
    expect(gpf?.onHandReserved).toBe(0);
    expect(gpf?.inTransitReserved).toBe(1230);
    expect(gpf?.inTransitUnreserved).toBe(296);
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
        'Shipment Status': 'Delivered',
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
    expect(abc?.actualQuantityReceived).toBe(100);
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
        'Shipment Status': 'Delivered',
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
    expect(abc?.actualQuantityReceived).toBe(7);
  });

  it('does not auto-create supplier short quantities from PO vs received', () => {
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
    expect(xyz?.supplierShortQty).toBe(0);
    expect(xyz?.actualQuantityReceived).toBe(100);
  });

  it('allows recording supplier short via movements and prefers the manual supplier short qty', () => {
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
      {
        id: 2,
        productCode: 'XYZ-9',
        quantity: 5,
        fromBucket: 'sellable',
        toBucket: 'supplier_short',
      },
    ];

    const items = buildInventoryItems(products, [], [], movements);
    const xyz = items.find((i) => i.productCode === 'XYZ-9');

    expect(xyz).toBeDefined();
    // supplier_short is informational and does not reduce on-hand.
    expect(xyz?.sellableOnHand).toBe(80);
    // When there is a manual supplier short entry, the UI prefers that value.
    expect(xyz?.supplierShortQty).toBe(5);
    expect(xyz?.actualQuantityReceived).toBe(95);
  });

  it('treats sellable movements as adjustments when there are no sellable receipts', () => {
    const products: ProductFromAPI[] = [
      {
        id: 'p1',
        'Product Code': 'ABC-1',
        Quantity: 10,
        COGS: 0,
        'Actual Price': 5,
        'Shipment Code': null,
        'Shipment Status': 'Delivered',
      },
    ];

    const movements: InventoryMovementFromAPI[] = [
      {
        id: 1,
        productCode: 'ABC-1',
        quantity: 3,
        fromBucket: 'sellable',
        toBucket: 'supplier_short',
      },
    ];

    const items = buildInventoryItems(products, [], [], movements);
    const abc = items.find((i) => i.productCode === 'ABC-1');

    expect(abc).toBeDefined();
    // supplier_short does not change sellable on-hand.
    expect(abc?.sellableOnHand).toBe(10);
    expect(abc?.actualQuantityReceived).toBe(7);
  });
});
