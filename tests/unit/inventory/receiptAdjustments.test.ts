import { describe, it, expect } from 'vitest';
import { computeSellableReceiptAdjustment } from '@/lib/inventory/receiptAdjustments';
import type { MovementLike } from '@/lib/inventory/movements';

describe('computeSellableReceiptAdjustment', () => {
  it('returns noop when already at target (within tolerance)', () => {
    const movements: MovementLike[] = [
      {
        productCode: ' ABC ',
        quantity: 5,
        fromBucket: 'scrap',
        toBucket: 'sellable',
      },
    ];

    const result = computeSellableReceiptAdjustment({
      productCode: 'abc',
      targetSellableOnHand: 5,
      movements,
    });

    expect(result.action).toBe('noop');
    expect(result.delta).toBe(0);
    expect(result.currentSellableOnHand).toBe(5);
  });

  it('creates a scrap→sellable adjustment when target is higher', () => {
    const movements: MovementLike[] = [
      {
        productCode: 'SKU1',
        quantity: 2,
        fromBucket: 'scrap',
        toBucket: 'sellable',
      },
    ];

    const result = computeSellableReceiptAdjustment({
      productCode: 'SKU1',
      targetSellableOnHand: 5,
      movements,
    });

    expect(result.action).toBe('create_movement');
    expect(result.delta).toBe(3);
    expect(result.movement).toEqual({
      fromBucket: 'scrap',
      toBucket: 'sellable',
      quantity: 3,
    });
  });

  it('creates a sellable→scrap adjustment when target is lower', () => {
    const movements: MovementLike[] = [
      {
        productCode: 'SKU2',
        quantity: 10,
        fromBucket: 'scrap',
        toBucket: 'sellable',
      },
      {
        productCode: 'SKU2',
        quantity: 4,
        fromBucket: 'sellable',
        toBucket: 'sold',
      },
    ];

    const result = computeSellableReceiptAdjustment({
      productCode: 'SKU2',
      targetSellableOnHand: 3,
      movements,
    });

    expect(result.action).toBe('create_movement');
    expect(result.currentSellableOnHand).toBe(6);
    expect(result.delta).toBe(-3);
    expect(result.movement).toEqual({
      fromBucket: 'sellable',
      toBucket: 'scrap',
      quantity: 3,
    });
  });

  it('supports routing negative adjustments to damaged_hold', () => {
    const movements: MovementLike[] = [
      {
        productCode: 'SKU3',
        quantity: 8,
        fromBucket: 'scrap',
        toBucket: 'sellable',
      },
    ];

    const result = computeSellableReceiptAdjustment({
      productCode: 'SKU3',
      targetSellableOnHand: 5,
      movements,
      negativeToBucket: 'damaged_hold',
    });

    expect(result.action).toBe('create_movement');
    expect(result.movement).toEqual({
      fromBucket: 'sellable',
      toBucket: 'damaged_hold',
      quantity: 3,
    });
  });
});
