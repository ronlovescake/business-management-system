import { describe, expect, it } from 'vitest';
import {
  allocateOriginalPhysicalReturn,
  remainingOriginalSaleAllocations,
} from '../physical-returns';

const first = {
  id: 1,
  productCode: 'TOP',
  quantity: 2,
  unitCost: 5,
  costBasis: 'RECORDED_COST',
  postingDate: '2026-10-27',
  createdAt: new Date('2026-10-27T00:00:00Z'),
};
const second = {
  ...first,
  id: 2,
  productCode: 'BOTTOM',
  quantity: 1,
  unitCost: 10,
};

describe('original actual physical-return allocations', () => {
  it('requires the actual original component rather than guessing a mix redistribution', () => {
    expect(() =>
      allocateOriginalPhysicalReturn([first, second], [], {
        quantity: 1,
        date: '2026-10-28',
      })
    ).toThrow('Select the actual fulfilled component');
    expect(
      allocateOriginalPhysicalReturn([first, second], [], {
        productCode: 'BOTTOM',
        quantity: 1,
        date: '2026-10-28',
      })
    ).toEqual([second]);
  });

  it('caps each component independently and cannot substitute unused sibling quantities', () => {
    expect(() =>
      allocateOriginalPhysicalReturn(
        [first, second],
        [{ sourceMovementId: 2, productCode: 'BOTTOM', quantity: 1 }],
        { productCode: 'BOTTOM', quantity: 1, date: '2026-10-28' }
      )
    ).toThrow('exceeds the recorded sold quantity');
    expect(
      remainingOriginalSaleAllocations(
        [first, second],
        [{ sourceMovementId: 2, productCode: 'BOTTOM', quantity: 1 }]
      )
    ).toEqual([first]);
  });

  it('restores mixed paid/free original allocations without replacing explicit zero cost', () => {
    const free = {
      ...first,
      id: 3,
      quantity: 1,
      unitCost: 0,
      costBasis: 'FREE_GOODS',
    };
    expect(
      allocateOriginalPhysicalReturn([first, free], [], {
        quantity: 3,
        date: '2026-10-28',
      }).map((sale) => [sale.id, sale.quantity, sale.unitCost])
    ).toEqual([
      [1, 2, 5],
      [3, 1, 0],
    ]);
  });

  it('rejects unknown zero cost and returns before the sale without inventing snapshots', () => {
    expect(() =>
      allocateOriginalPhysicalReturn(
        [{ ...first, unitCost: 0, costBasis: null }],
        [],
        { quantity: 1, date: '2026-10-28' }
      )
    ).toThrow('known quantity and cost');
    expect(() =>
      allocateOriginalPhysicalReturn([first], [], {
        quantity: 1,
        date: '2026-10-26',
      })
    ).toThrow('cannot precede');
  });
});
