import { describe, expect, it } from 'vitest';
import { buildInventoryItems } from '../inventoryTransforms';
import type {
  InventoryMovementFromAPI,
  MixAndMatchBatchFromAPI,
  ProductFromAPI,
  TransactionFromAPI,
} from '../../types';

describe('buildInventoryItems', () => {
  it('derives available stock from product quantity minus active transaction demand', () => {
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

    // SELLABLE deducts both RESERVED and SOLD quantities.
    expect(abc?.sellableOnHand).toBe(4);
    expect(abc?.reservedOnHand).toBe(4);
    expect(abc?.soldQty).toBe(2);
    expect(abc?.onHandSellable).toBe(4);
    expect(abc?.onHandReserved).toBe(4);
    expect(abc?.inTransitUnreserved).toBe(0);
    expect(abc?.inTransitReserved).toBe(0);
    expect(abc?.damagedOnHand).toBe(0);
    expect(abc?.scrapQty).toBe(0);
    expect(abc?.onhand).toBe(10);
    expect(abc?.actualQuantityReceived).toBe(10);

    // availability is based on product quantity minus active demand
    expect(abc?.availableStock).toBe(4);
    expect(abc?.supplierShortQty).toBe(0);

    // total sales uses active operational statuses (reserved + fulfilled)
    expect(abc?.totalSales).toBe(60);
    expect(abc?.endingInventoryValue).toBe(4 * 5);
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
    expect(xyz?.onHandSellable).toBe(7);
    expect(xyz?.onHandReserved).toBe(0);
    expect(xyz?.inTransitUnreserved).toBe(0);
    expect(xyz?.inTransitReserved).toBe(0);
    expect(xyz?.damagedOnHand).toBe(0);
    expect(xyz?.scrapQty).toBe(0);
    expect(xyz?.onhand).toBe(7);
    expect(xyz?.availableStock).toBe(7);
    expect(xyz?.supplierShortQty).toBe(0);
    expect(xyz?.actualQuantityReceived).toBe(7);
    expect(xyz?.shipmentCode).toBe('S1');
    expect(xyz?.shipmentStatus).toBe('In Transit');
  });

  it('derives in-transit unreserved from product quantity minus active demand', () => {
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

    const transactions: TransactionFromAPI[] = [
      {
        id: 't1',
        'Product Code': 'GPF-012426',
        Quantity: 1010,
        'Unit Price': 138,
        'Order Status': 'In Transit',
      },
    ];

    const items = buildInventoryItems(products, transactions, [], []);
    const gpf = items.find((i) => i.productCode === 'GPF-012426');

    expect(gpf).toBeDefined();
    expect(gpf?.onHandSellable).toBe(1790);
    expect(gpf?.onHandReserved).toBe(1010);
    expect(gpf?.inTransitReserved).toBe(0);
    expect(gpf?.inTransitUnreserved).toBe(0);
  });

  it('tracks damaged quantity separately and derives sellable from actual quantity', () => {
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
    expect(abc?.actualQuantityReceived).toBe(80);
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
    expect(abc?.sellableOnHand).toBe(10);
    expect(abc?.scrapQty).toBe(3);
    expect(abc?.actualQuantityReceived).toBe(10);
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
    expect(xyz?.onhand).toBe(100);
    expect(xyz?.damagedOnHand).toBe(0);
    expect(xyz?.scrapQty).toBe(0);
    expect(xyz?.supplierShortQty).toBe(0);
    expect(xyz?.actualQuantityReceived).toBe(100);
  });

  it('allows recording supplier short via movements and applies it to actual quantity', () => {
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
    // supplier_short reduces actual quantity, so sellable follows the reduced base.
    expect(xyz?.sellableOnHand).toBe(95);
    // When there is a manual supplier short entry, the UI prefers that value.
    expect(xyz?.supplierShortQty).toBe(5);
    expect(xyz?.actualQuantityReceived).toBe(95);
  });

  it('applies supplier short against actual quantity when no sellable receipts exist', () => {
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
    // supplier_short reduces actual quantity, which now drives sellable.
    expect(abc?.sellableOnHand).toBe(7);
    expect(abc?.actualQuantityReceived).toBe(7);
  });

  it('counts SOLD only for Ready For Dispatch, Checked Out, and Shipped', () => {
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

    const transactions: TransactionFromAPI[] = [
      {
        id: 't1',
        'Product Code': 'ABC-1',
        Quantity: 3,
        'Unit Price': 10,
        'Order Status': 'Ready For Dispatch',
      },
      {
        id: 't2',
        'Product Code': 'ABC-1',
        Quantity: 2,
        'Unit Price': 10,
        'Order Status': 'Checked Out',
      },
      {
        id: 't3',
        'Product Code': 'ABC-1',
        Quantity: 4,
        'Unit Price': 10,
        'Order Status': 'Shipped',
      },
      {
        id: 't4',
        'Product Code': 'ABC-1',
        Quantity: 5,
        'Unit Price': 10,
        'Order Status': 'Warehouse',
      },
    ];

    const items = buildInventoryItems(products, transactions, [], []);
    const abc = items.find((i) => i.productCode === 'ABC-1');

    expect(abc).toBeDefined();
    expect(abc?.soldQty).toBe(9);
    expect(abc?.reservedOnHand).toBe(5);
    expect(abc?.sellableOnHand).toBe(86);
  });

  it('allocates mix-and-match demand from pooled component capacity', () => {
    const products: ProductFromAPI[] = [
      {
        id: 'p-mix',
        'Product Code': 'Ruffled Onesie (RO-021426)',
        Quantity: 0,
        COGS: 0,
        'Actual Price': 69,
        'Shipment Code': null,
        'Shipment Status': 'Delivered',
      },
      {
        id: 'p-a',
        'Product Code': 'Sleeveless Onesie (SO-020726)',
        Quantity: 237,
        COGS: 0,
        'Actual Price': 0,
        'Shipment Code': null,
        'Shipment Status': 'Delivered',
      },
      {
        id: 'p-b',
        'Product Code': 'Ruffled Onesie (RO-020726)',
        Quantity: 362,
        COGS: 0,
        'Actual Price': 0,
        'Shipment Code': null,
        'Shipment Status': 'Delivered',
      },
    ];

    const transactions: TransactionFromAPI[] = [
      {
        id: 't-mix-1',
        'Product Code': 'Ruffled Onesie (RO-021426)',
        Quantity: 589,
        'Unit Price': 69,
        'Order Status': 'Warehouse',
      },
    ];

    const mixAndMatchBatches: MixAndMatchBatchFromAPI[] = [
      {
        id: 1,
        postingDate: '2026-02-14',
        mixAndMatchName: 'Ruffled Onesie',
        mixAndMatchSku: 'Ruffled Onesie (RO-021426)',
        price: 69,
        components: [
          {
            productCode: 'Sleeveless Onesie (SO-020726)',
            includedQuantity: 1,
          },
          {
            productCode: 'Ruffled Onesie (RO-020726)',
            includedQuantity: 1,
          },
        ],
      },
    ];

    const items = buildInventoryItems(
      products,
      transactions,
      [],
      [],
      mixAndMatchBatches
    );

    const sleeveless = items.find((i) => i.productCode.includes('SO-020726'));
    const ruffledComponent = items.find((i) =>
      i.productCode.includes('RO-020726')
    );

    expect(sleeveless?.sellableOnHand).toBe(0);
    expect(ruffledComponent?.sellableOnHand).toBe(10);
  });

  it('keeps Additionals separate from Supplier Short', () => {
    const products: ProductFromAPI[] = [
      {
        id: 'p1',
        'Product Code': 'Baby Shoes (BS-010826)',
        Quantity: 400,
        COGS: 0,
        'Actual Price': 0,
        'Shipment Code': null,
        'Shipment Status': 'Delivered',
      },
    ];

    const movements: InventoryMovementFromAPI[] = [
      {
        id: 1,
        productCode: 'Baby Shoes (BS-010826)',
        quantity: 9,
        fromBucket: 'supplier_short',
        toBucket: 'sellable',
        notes: 'additionals: correction',
      },
    ];

    const items = buildInventoryItems(products, [], [], movements);
    const babyShoes = items.find((i) => i.productCode.includes('BS-010826'));

    expect(babyShoes?.additionalsQty).toBe(9);
    expect(babyShoes?.supplierShortQty).toBe(0);
  });
});
