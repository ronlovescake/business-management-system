import { describe, expect, it } from 'vitest';
import {
  buildCogsEntriesFromMovements,
  projectDatedMovementCosts,
} from '../inventoryCogsShared';

describe('dated inventory cost history', () => {
  it.each(['2026-10-25', '2026-10-26'])(
    'preserves an original missing-cost basis and only confirms it at the dated event: %s',
    (cutoff) => {
      const movements = [
        {
          id: 42,
          createdAt: new Date('2026-10-20'),
          postingDate: '2026-10-20',
          productCode: 'SKU',
          quantity: 4,
          unitCost: null,
          fromBucket: 'sellable',
          toBucket: 'sold',
          sourceTransactionId: 12,
          when: new Date('2026-10-20'),
        },
      ];
      const result = projectDatedMovementCosts(
        movements,
        [
          {
            productCode: 'SKU',
            date: '2026-10-26',
            newUnitCost: 120,
            resolvedMovementIds: [42],
            movementCosts: [{ movementId: 42, unitCost: 100 }],
          },
        ],
        new Date(`${cutoff}T12:00:00Z`)
      );
      expect(result[0].unitCost).toBe(100);
      expect(result[0].valuationConfirmed).toBe(cutoff === '2026-10-26');
      const report = buildCogsEntriesFromMovements({
        movements: result,
        unitCostByProductCode: new Map([['SKU', 120]]),
        customerNameByTransactionId: new Map(),
        cogsAccount: 'COGS',
        inventoryAccount: 'Stock on Hand',
        cogsDescriptionStyle: 'short',
      });
      expect(report.totalCogs).toBe(400);
      expect(report.valuationIssues).toHaveLength(
        cutoff === '2026-10-26' ? 0 : 1
      );
      expect(movements[0].unitCost).toBeNull();
    }
  );
  it('restores the corrected carrying cost for a linked later return without rewriting either snapshot', () => {
    const movements = [
      {
        id: 42,
        createdAt: new Date('2026-10-20'),
        postingDate: '2026-10-20',
        productCode: 'SKU',
        quantity: 4,
        unitCost: 100,
        fromBucket: 'sellable',
        toBucket: 'sold',
        sourceTransactionId: 12,
        when: new Date('2026-10-20'),
      },
      {
        id: 43,
        createdAt: new Date('2026-10-28'),
        postingDate: '2026-10-28',
        productCode: 'SKU',
        quantity: 1,
        unitCost: 100,
        fromBucket: 'sold',
        toBucket: 'sellable',
        sourceTransactionId: 12,
        when: new Date('2026-10-28'),
      },
    ];
    const result = projectDatedMovementCosts(
      movements,
      [
        {
          productCode: 'SKU',
          date: '2026-10-26',
          newUnitCost: 120,
          resolvedMovementIds: [42],
          movementCosts: [{ movementId: 42, unitCost: 100 }],
        },
      ],
      new Date('2026-10-28T12:00:00Z')
    );
    expect(result.map((movement) => movement.unitCost)).toEqual([100, 120]);
    expect(movements.map((movement) => movement.unitCost)).toEqual([100, 100]);
  });
});

describe('buildCogsEntriesFromMovements', () => {
  it.each([
    { unitCost: null, fallback: undefined, reason: 'MISSING_COST', total: 0 },
    {
      unitCost: Number.NaN,
      fallback: undefined,
      reason: 'INVALID_COST',
      total: 0,
    },
    {
      unitCost: null,
      fallback: Number.POSITIVE_INFINITY,
      reason: 'INVALID_COST',
      total: 0,
    },
    { unitCost: null, fallback: -75, reason: 'INVALID_COST', total: 0 },
    { unitCost: null, fallback: 75, reason: 'LEGACY_PRODUCT_COST', total: 150 },
  ])(
    'reports valuation incompleteness rather than silently certifying $reason',
    ({ unitCost, fallback, reason, total }) => {
      const result = buildCogsEntriesFromMovements({
        movements: [
          {
            id: 42,
            createdAt: new Date('2026-01-20'),
            postingDate: '2026-01-20',
            productCode: 'SKU',
            quantity: 2,
            unitCost,
            fromBucket: 'sellable',
            toBucket: 'sold',
            when: new Date('2026-01-20'),
          },
        ],
        unitCostByProductCode: new Map(
          fallback === undefined ? [] : [['SKU', fallback]]
        ),
        customerNameByTransactionId: new Map(),
        cogsAccount: 'COGS',
        inventoryAccount: 'Stock on Hand',
        cogsDescriptionStyle: 'short',
      });
      expect(result.totalCogs).toBe(total);
      expect(result.valuationIssues).toEqual([
        {
          movementId: 42,
          productCode: 'SKU',
          date: '2026-01-20',
          quantity: 2,
          direction: 'SALE',
          reason,
        },
      ]);
    }
  );

  it.each([false, true])(
    'distinguishes an unknown zero-cost return from explicit confirmation: %s',
    (confirmed) => {
      const result = buildCogsEntriesFromMovements({
        movements: [
          {
            id: 42,
            createdAt: new Date('2026-01-20'),
            postingDate: '2026-01-20',
            productCode: 'SKU',
            quantity: 2,
            unitCost: 0,
            fromBucket: 'sold',
            toBucket: 'sellable',
            when: new Date('2026-01-20'),
          },
        ],
        unitCostByProductCode: new Map(),
        customerNameByTransactionId: new Map(),
        confirmedZeroCostMovementIds: new Set(confirmed ? [42] : []),
        cogsAccount: 'COGS',
        inventoryAccount: 'Stock on Hand',
        cogsDescriptionStyle: 'short',
      });
      expect(result.entries).toEqual([]);
      expect(result.totalCogs).toBe(0);
      expect(result.valuationIssues).toHaveLength(confirmed ? 0 : 1);
      if (!confirmed) {
        expect(result.valuationIssues[0]).toMatchObject({
          direction: 'RETURN',
          quantity: 2,
        });
      }
    }
  );

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

  it('does not reverse COGS when returned goods are moved to scrap', () => {
    const result = buildCogsEntriesFromMovements({
      movements: [
        {
          createdAt: new Date('2026-01-21T01:00:00.000Z'),
          postingDate: '2026-01-21',
          productCode: 'SKU-1',
          quantity: 1,
          fromBucket: 'sold',
          toBucket: 'scrap',
          when: new Date('2026-01-21T01:00:00.000Z'),
        },
      ],
      unitCostByProductCode: new Map([['SKU-1', 75]]),
      customerNameByTransactionId: new Map(),
      cogsAccount: 'COGS',
      inventoryAccount: 'Stock on Hand',
      cogsDescriptionStyle: 'short',
    });

    expect(result.totalCogs).toBe(0);
    expect(result.entries).toEqual([]);
  });

  it('uses the movement cost snapshot instead of the latest product cost', () => {
    const result = buildCogsEntriesFromMovements({
      movements: [
        {
          createdAt: new Date('2026-01-20T01:00:00.000Z'),
          postingDate: '2026-01-20',
          productCode: 'SKU-1',
          quantity: 2,
          unitCost: 75,
          fromBucket: 'sellable',
          toBucket: 'sold',
          when: new Date('2026-01-20T01:00:00.000Z'),
        },
      ],
      unitCostByProductCode: new Map([['SKU-1', 125]]),
      customerNameByTransactionId: new Map(),
      cogsAccount: 'COGS',
      inventoryAccount: 'Stock on Hand',
      cogsDescriptionStyle: 'short',
    });

    expect(result.totalCogs).toBe(150);
  });
});
