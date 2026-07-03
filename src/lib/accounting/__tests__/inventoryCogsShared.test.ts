import { describe, expect, it } from 'vitest';
import { buildCogsEntriesFromMovements } from '../inventoryCogsShared';

describe('buildCogsEntriesFromMovements', () => {
  it('builds debit and credit entries from explicit auto-sale movement metadata', () => {
    const result = buildCogsEntriesFromMovements({
      movements: [
        {
          createdAt: new Date('2026-01-20T01:00:00.000Z'),
          postingDate: '2026-01-01',
          productCode: 'SKU-1',
          quantity: 2,
          fromBucket: 'sellable',
          toBucket: 'sold',
          notes: 'manual note',
          sourceTransactionId: 456,
          movementSource: 'transaction',
          movementType: 'sale',
          when: new Date('2026-01-20T01:00:00.000Z'),
        },
      ],
      unitCostByProductCode: new Map([['SKU-1', 75]]),
      customerNameByTransactionId: new Map([[456, 'Explicit Customer']]),
      cogsAccount: 'COGS',
      inventoryAccount: 'Stock on Hand',
      cogsDescriptionStyle: 'verbose',
    });

    expect(result.totalCogs).toBe(150);
    expect(result.entries).toEqual([
      expect.objectContaining({
        account: 'COGS',
        debit: 150,
        credit: 0,
        description: expect.stringContaining('Explicit Customer'),
      }),
      expect.objectContaining({
        account: 'Stock on Hand',
        debit: 0,
        credit: 150,
        description: expect.stringContaining('sellable→sold +2'),
      }),
    ]);
  });

  it('builds reversal entries when sold inventory returns to stock', () => {
    const result = buildCogsEntriesFromMovements({
      movements: [
        {
          createdAt: new Date('2026-01-21T01:00:00.000Z'),
          postingDate: '2026-01-21',
          productCode: 'SKU-1',
          quantity: 1,
          fromBucket: 'sold',
          toBucket: 'sellable',
          when: new Date('2026-01-21T01:00:00.000Z'),
        },
      ],
      unitCostByProductCode: new Map([['SKU-1', 75]]),
      customerNameByTransactionId: new Map(),
      cogsAccount: 'COGS',
      inventoryAccount: 'Stock on Hand',
      cogsDescriptionStyle: 'short',
    });

    expect(result.totalCogs).toBe(-75);
    expect(result.entries).toEqual([
      expect.objectContaining({
        account: 'Stock on Hand',
        debit: 75,
        credit: 0,
      }),
      expect.objectContaining({
        account: 'COGS',
        debit: 0,
        credit: 75,
      }),
    ]);
  });
});
