import { describe, expect, it } from 'vitest';

import { buildBackupChangePreview } from '@/lib/backup/backupChangePreview';

describe('backup change preview', () => {
  it('reports added, updated, and removed rows for a table', () => {
    const preview = buildBackupChangePreview(
      'transactions',
      [
        {
          id: 1,
          customers: 'Alice',
          quantity: 1,
          updatedAt: '2026-04-04T01:00:00.000Z',
        },
        {
          id: 2,
          customers: 'Bob',
          quantity: 2,
        },
      ],
      [
        {
          id: 1,
          customers: 'Alice',
          quantity: 3,
          updatedAt: '2026-04-04T06:00:00.000Z',
        },
        {
          id: 3,
          customers: 'Cara',
          quantity: 1,
        },
      ]
    );

    expect(preview.backupCount).toBe(2);
    expect(preview.currentCount).toBe(2);
    expect(preview.addedCount).toBe(1);
    expect(preview.updatedCount).toBe(1);
    expect(preview.removedCount).toBe(1);
    expect(preview.added[0]).toEqual(
      expect.objectContaining({ id: 3, customers: 'Cara' })
    );
    expect(preview.removed[0]).toEqual(
      expect.objectContaining({ id: 2, customers: 'Bob' })
    );
    expect(preview.updates[0]).toEqual(
      expect.objectContaining({
        id: 1,
        changes: {
          quantity: {
            before: 1,
            after: 3,
          },
        },
      })
    );
  });

  it('rejects rows without stable ids', () => {
    expect(() =>
      buildBackupChangePreview('transactions', [{ customers: 'Alice' }], [])
    ).toThrow(/requires stable IDs/i);
  });
});
