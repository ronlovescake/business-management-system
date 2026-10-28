import { describe, expect, it } from 'vitest';
import { buildInventoryItems } from '../inventoryTransforms';
import type {
  InventoryMovementFromAPI,
  MixAndMatchBatchFromAPI,
  ProductFromAPI,
  SplitBatchFromAPI,
  TransactionFromAPI,
} from '../../types';

describe('buildInventoryItems', () => {
  it('projects recorded split pieces and partial returns without reopening or double-counting a parent set', () => {
    const products: ProductFromAPI[] = ['SET', 'TOP', 'BOTTOM'].map(
      (code, index) => ({
        id: String(index + 1),
        'Product Code': code,
        Quantity: index === 0 ? 10 : 0,
        COGS: 0,
        'Actual Price': index === 0 ? 20 : 5,
        'Shipment Code': null,
        'Shipment Status': 'Delivered',
      })
    );
    const splitBatches: SplitBatchFromAPI[] = [
      {
        id: 1,
        postingDate: '2026-10-28',
        splitName: 'Set',
        splitSku: 'SET',
        components: [
          {
            componentLabel: 'Top',
            componentSku: 'TOP',
            componentPrice: 50,
            includedQuantity: 2,
          },
          {
            componentLabel: 'Bottom',
            componentSku: 'BOTTOM',
            componentPrice: 50,
            includedQuantity: 1,
          },
        ],
      },
    ];
    const movements: InventoryMovementFromAPI[] = [
      {
        id: 1,
        productCode: 'SET',
        quantity: 1,
        fromBucket: 'sellable',
        toBucket: 'opening_inventory',
        movementSource: 'inventory_split',
        movementType: 'split_open',
        notes: 'split:1: opening',
      },
      {
        id: 2,
        productCode: 'TOP',
        quantity: 2,
        fromBucket: 'opening_inventory',
        toBucket: 'sellable',
        movementSource: 'inventory_split',
        movementType: 'split_piece_receipt',
        notes: 'split:1: opening',
      },
      {
        id: 3,
        productCode: 'BOTTOM',
        quantity: 1,
        fromBucket: 'opening_inventory',
        toBucket: 'sellable',
        movementSource: 'inventory_split',
        movementType: 'split_piece_receipt',
        notes: 'split:1: opening',
      },
      {
        id: 4,
        productCode: 'TOP',
        quantity: 2,
        fromBucket: 'reserved',
        toBucket: 'sold',
        movementSource: 'transaction',
        movementType: 'sale',
        sourceTransactionId: 7,
      },
      {
        id: 5,
        productCode: 'TOP',
        quantity: 1,
        fromBucket: 'sold',
        toBucket: 'sellable',
        movementSource: 'customer_refund',
        movementType: 'return',
        sourceTransactionId: 7,
      },
    ];
    const transactions: TransactionFromAPI[] = [
      {
        id: '7',
        'Product Code': 'TOP',
        Quantity: 2,
        'Unit Price': 50,
        'Order Status': 'Accounts Receivable',
      },
    ];
    const result = buildInventoryItems(
      products,
      transactions,
      [],
      movements,
      [],
      splitBatches
    );
    expect(result.find((item) => item.productCode === 'SET')).toMatchObject({
      actualQuantityReceived: 9,
      availableStock: 9,
      soldQty: 0,
    });
    expect(result.find((item) => item.productCode === 'TOP')).toMatchObject({
      actualQuantityReceived: 2,
      availableStock: 1,
      soldQty: 2,
    });
    expect(result.find((item) => item.productCode === 'BOTTOM')).toMatchObject({
      actualQuantityReceived: 1,
      availableStock: 1,
    });
  });

  it.each(['Shipped', 'Cancelled', 'Voided'])(
    'preserves an identified actual sale after status %s without double counting',
    (status) => {
      const products: ProductFromAPI[] = [
        {
          id: '1',
          'Product Code': 'SKU',
          Quantity: 100,
          COGS: 0,
          'Actual Price': 5,
          'Shipment Code': 'S1',
          'Shipment Status': 'Delivered',
        },
      ];
      const transactions: TransactionFromAPI[] = [
        {
          id: '1',
          'Product Code': 'SKU',
          Quantity: 20,
          'Unit Price': 10,
          'Order Status': status,
        },
      ];
      const movements: InventoryMovementFromAPI[] = [
        {
          id: 1,
          productCode: 'SKU',
          quantity: 20,
          fromBucket: 'sellable',
          toBucket: 'sold',
          sourceTransactionId: 1,
          movementSource: 'transaction',
          movementType: 'sale',
        },
      ];
      expect(
        buildInventoryItems(products, transactions, [], movements)[0]
      ).toMatchObject({ soldQty: 20, availableStock: 80 });
      movements.push({
        id: 2,
        productCode: 'SKU',
        quantity: 5,
        fromBucket: 'sold',
        toBucket: 'sellable',
      });
      expect(
        buildInventoryItems(products, transactions, [], movements)[0]
      ).toMatchObject({ soldQty: 20, availableStock: 85 });
    }
  );

  it('never presents a credited missing purchase as received or sellable', () => {
    const products: ProductFromAPI[] = [
      {
        id: '42',
        'Product Code': 'DTTP-101626',
        Quantity: 100,
        COGS: 19511.37,
        'Actual Price': 300,
        'Shipment Code': 'KPC 23930A-239',
        'Shipment Status': 'Delivered',
        'Supplier Fulfillment Status': 'CREDIT_ISSUED',
      },
    ];
    const movements: InventoryMovementFromAPI[] = [
      {
        id: 1,
        productCode: 'DTTP-101626',
        quantity: 100,
        fromBucket: 'supplier_short',
        toBucket: 'sellable',
        notes: 'Additionals',
      },
    ];
    const [item] = buildInventoryItems(products, [], [], movements);
    expect(item).toMatchObject({
      actualQuantityReceived: 0,
      sellableOnHand: 0,
      availableStock: 0,
      endingInventoryValue: 0,
      supplierShortQty: 100,
    });
  });

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

  it('keeps unreceived product quantity in transit when no physical receipt exists', () => {
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
    expect(xyz?.sellableOnHand).toBe(0);
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
    expect(xyz?.actualQuantityReceived).toBe(0);
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
    expect(gpf?.onHandSellable).toBe(0);
    expect(gpf?.onHandReserved).toBe(0);
    expect(gpf?.inTransitReserved).toBe(1010);
    expect(gpf?.inTransitUnreserved).toBe(1790);
  });

  it.each(['In Transit', 'Delivered'])(
    'bounds physical reservation quantities by %s supply without posting movements',
    (status) => {
      const products: ProductFromAPI[] = [
        {
          id: '1',
          'Product Code': 'SKU',
          Quantity: 10,
          COGS: 0,
          'Actual Price': 5,
          'Shipment Code': 'S1',
          'Shipment Status': status,
        },
      ];
      const transactions: TransactionFromAPI[] = [
        {
          id: '1',
          'Product Code': 'SKU',
          Quantity: 15,
          'Unit Price': 10,
          'Order Status': 'Prepared',
        },
      ];
      const movements: InventoryMovementFromAPI[] = [];
      const before = structuredClone({ products, transactions, movements });
      const [item] = buildInventoryItems(products, transactions, [], movements);
      expect(item).toMatchObject(
        status === 'In Transit'
          ? {
              onHandSellable: 0,
              onHandReserved: 0,
              inTransitReserved: 10,
              inTransitUnreserved: 0,
              actualQuantityReceived: 0,
            }
          : {
              onHandSellable: 0,
              onHandReserved: 10,
              inTransitReserved: 0,
              inTransitUnreserved: 0,
              actualQuantityReceived: 10,
            }
      );
      expect({ products, transactions, movements }).toEqual(before);
    }
  );

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
    expect(abc?.sellableOnHand).toBe(7);
    expect(abc?.scrapQty).toBe(3);
    expect(abc?.actualQuantityReceived).toBe(10);
  });

  it.each([
    { bucket: 'sellable' as const, available: 85, damaged: 0, scrap: 0 },
    { bucket: 'damaged_hold' as const, available: 80, damaged: 5, scrap: 0 },
    { bucket: 'scrap' as const, available: 80, damaged: 0, scrap: 5 },
    { bucket: 'reserved' as const, available: 80, damaged: 0, scrap: 0 },
    { bucket: 'assembly_wip' as const, available: 80, damaged: 0, scrap: 0 },
  ])(
    'accounts for physical returns to $bucket exactly once',
    ({ bucket, available, damaged, scrap }) => {
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
          Quantity: 20,
          'Unit Price': 10,
          'Order Status': 'Shipped',
        },
      ];
      const movements: InventoryMovementFromAPI[] = [
        {
          id: 1,
          productCode: 'ABC-1',
          quantity: 5,
          fromBucket: 'sold',
          toBucket: bucket,
          notes: 'auto-return refund 1',
        },
      ];

      const [item] = buildInventoryItems(products, transactions, [], movements);

      expect(item.availableStock).toBe(available);
      expect(item.damagedOnHand).toBe(damaged);
      expect(item.scrapQty).toBe(scrap);
    }
  );

  it('does not release sellable stock when damaged goods are scrapped', () => {
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
        quantity: 10,
        fromBucket: 'sellable',
        toBucket: 'damaged_hold',
      },
      {
        id: 2,
        productCode: 'ABC-1',
        quantity: 5,
        fromBucket: 'damaged_hold',
        toBucket: 'scrap',
      },
    ];

    const [item] = buildInventoryItems(products, [], [], movements);

    expect(item.availableStock).toBe(90);
    expect(item.damagedOnHand).toBe(5);
    expect(item.scrapQty).toBe(5);
  });

  it('reverses manual scrap without treating the original receipt as a reversal', () => {
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
      {
        id: 3,
        productCode: 'ABC-1',
        quantity: 2,
        fromBucket: 'scrap',
        toBucket: 'sellable',
        movementSource: 'inventory_adjustment',
      },
    ];

    const [item] = buildInventoryItems(products, [], [], movements);

    expect(item.availableStock).toBe(9);
    expect(item.scrapQty).toBe(1);
    expect(item.actualQuantityReceived).toBe(10);
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

  it('rolls split-child transaction demand up to the parent SKU', () => {
    const products: ProductFromAPI[] = [
      {
        id: 'p-parent',
        'Product Code': 'A2PCS-031926',
        Quantity: 10,
        COGS: 0,
        'Actual Price': 120,
        'Shipment Code': 'SHIP-1',
        'Shipment Status': 'Delivered',
      },
    ];

    const transactions: TransactionFromAPI[] = [
      {
        id: 't-split-1',
        'Product Code': 'TOP-031926',
        Quantity: 2,
        'Unit Price': 100,
        'Order Status': 'Warehouse',
      },
    ];

    const splitBatches: SplitBatchFromAPI[] = [
      {
        id: 1,
        postingDate: '2026-04-14',
        splitName: 'Anko 2-PC Set',
        splitSku: 'A2PCS-031926',
        components: [
          {
            id: 1,
            componentLabel: 'Top',
            componentSku: 'TOP-031926',
            componentPrice: 100,
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
      [],
      splitBatches
    );

    const parent = items.find((item) => item.productCode === 'A2PCS-031926');

    expect(parent).toBeDefined();
    expect(parent?.reservedOnHand).toBe(2);
    expect(parent?.sellableOnHand).toBe(8);
    expect(parent?.totalSales).toBe(200);
  });

  it('reuses loose sibling pieces before opening another set', () => {
    const products: ProductFromAPI[] = [
      {
        id: 'p-parent',
        'Product Code': 'A2PCS-031926',
        Quantity: 328,
        COGS: 0,
        'Actual Price': 120,
        'Shipment Code': 'SHIP-1',
        'Shipment Status': 'Delivered',
      },
    ];

    const transactions: TransactionFromAPI[] = [
      {
        id: 't-top',
        'Product Code': 'TOP-031926',
        Quantity: 300,
        'Unit Price': 100,
        'Order Status': 'Warehouse',
      },
      {
        id: 't-bottom',
        'Product Code': 'BOTTOM-031926',
        Quantity: 300,
        'Unit Price': 100,
        'Order Status': 'Warehouse',
      },
    ];

    const splitBatches: SplitBatchFromAPI[] = [
      {
        id: 1,
        postingDate: '2026-04-14',
        splitName: 'Anko 2-PC Set',
        splitSku: 'A2PCS-031926',
        components: [
          {
            id: 1,
            componentLabel: 'Top',
            componentSku: 'TOP-031926',
            componentPrice: 100,
            includedQuantity: 1,
          },
          {
            id: 2,
            componentLabel: 'Bottom',
            componentSku: 'BOTTOM-031926',
            componentPrice: 100,
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
      [],
      splitBatches
    );

    const parent = items.find((item) => item.productCode === 'A2PCS-031926');

    expect(parent).toBeDefined();
    expect(parent?.reservedOnHand).toBe(300);
    expect(parent?.sellableOnHand).toBe(28);
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
