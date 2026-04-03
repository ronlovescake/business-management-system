import { describe, expect, it } from 'vitest';

import { buildBackupChangesComparison } from '@/lib/backup/backupChanges';
import type { RestoreVerificationSnapshot } from '@/lib/backup/restoreVerification';

describe('backup changes comparison', () => {
  it('classifies increased, decreased, unchanged, and missing tables', () => {
    const liveSnapshot: RestoreVerificationSnapshot = {
      generatedAt: '2026-04-04T06:00:00.000Z',
      entries: [
        {
          key: 'transactions',
          modelName: 'Transaction',
          schema: 'public',
          table: 'Transaction',
          coverage: 'selective-json',
          count: 14,
        },
        {
          key: 'customers',
          modelName: 'Customer',
          schema: 'public',
          table: 'Customer',
          coverage: 'selective-json',
          count: 2,
        },
        {
          key: 'products',
          modelName: 'Product',
          schema: 'public',
          table: 'Product',
          coverage: 'selective-json',
          count: 5,
        },
      ],
      skippedEntries: [
        {
          key: 'change_log',
          modelName: 'ChangeLog',
          schema: 'public',
          table: 'ChangeLog',
          coverage: 'log-only',
          reason: 'table-missing',
        },
      ],
    };

    const comparison = buildBackupChangesComparison({
      backupTimestamp: '2026-04-04T04-46-07',
      backupCreatedAt: '2026-04-04T04:46:07.000Z',
      backupRecordCounts: {
        transactions: 10,
        customers: 4,
        products: 5,
        change_log: 2,
      },
      liveSnapshot,
    });

    expect(comparison.changedTables).toBe(3);
    expect(comparison.increasedTables).toBe(1);
    expect(comparison.decreasedTables).toBe(1);
    expect(comparison.missingTables).toBe(1);
    expect(comparison.unchangedTables).toBe(1);
    expect(comparison.deltaRecords).toBe(0);
    expect(comparison.entries).toHaveLength(4);
    expect(comparison.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'transactions',
          status: 'increased',
          delta: 4,
        }),
        expect.objectContaining({
          key: 'customers',
          status: 'decreased',
          delta: -2,
        }),
        expect.objectContaining({
          key: 'change_log',
          status: 'missing',
          reason: 'table-missing',
        }),
        expect.objectContaining({
          key: 'products',
          status: 'unchanged',
          delta: 0,
        }),
      ])
    );
  });
});
