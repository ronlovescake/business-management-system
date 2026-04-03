import { describe, expect, it } from 'vitest';

import {
  buildRecordCountsFromSnapshot,
  compareRestoreVerificationSnapshots,
  type RestoreVerificationSnapshot,
} from '@/lib/backup/restoreVerification';

describe('restore verification snapshot helpers', () => {
  it('builds record counts from snapshot entries', () => {
    const snapshot: RestoreVerificationSnapshot = {
      generatedAt: '2026-04-04T00:00:00.000Z',
      entries: [
        {
          key: 'customers',
          modelName: 'Customer',
          schema: 'public',
          table: 'Customer',
          coverage: 'selective-json',
          count: 3,
        },
        {
          key: 'public.User',
          modelName: 'User',
          schema: 'public',
          table: 'User',
          coverage: 'dump-only',
          count: 2,
        },
      ],
    };

    expect(buildRecordCountsFromSnapshot(snapshot)).toEqual({
      customers: 3,
      'public.User': 2,
    });
  });

  it('detects mismatched and missing restore verification entries', () => {
    const expected: RestoreVerificationSnapshot = {
      generatedAt: '2026-04-04T00:00:00.000Z',
      entries: [
        {
          key: 'customers',
          modelName: 'Customer',
          schema: 'public',
          table: 'Customer',
          coverage: 'selective-json',
          count: 3,
        },
        {
          key: 'public.User',
          modelName: 'User',
          schema: 'public',
          table: 'User',
          coverage: 'dump-only',
          count: 2,
        },
      ],
    };

    const actual: RestoreVerificationSnapshot = {
      generatedAt: '2026-04-04T00:10:00.000Z',
      entries: [
        {
          key: 'customers',
          modelName: 'Customer',
          schema: 'public',
          table: 'Customer',
          coverage: 'selective-json',
          count: 4,
        },
        {
          key: 'transactions',
          modelName: 'Transaction',
          schema: 'public',
          table: 'Transaction',
          coverage: 'selective-json',
          count: 5,
        },
      ],
    };

    const comparison = compareRestoreVerificationSnapshots(expected, actual);

    expect(comparison.matchedEntries).toHaveLength(0);
    expect(comparison.mismatchedEntries).toHaveLength(1);
    expect(comparison.mismatchedEntries[0]?.expected.key).toBe('customers');
    expect(comparison.missingEntries).toEqual([
      expect.objectContaining({ key: 'public.User' }),
    ]);
    expect(comparison.unexpectedEntries).toEqual([
      expect.objectContaining({ key: 'transactions' }),
    ]);
  });
});
