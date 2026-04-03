import type { BackupCoverageClass } from '@/lib/backup/backupModelRegistry';
import {
  buildRecordCountsFromSnapshot,
  getRestoreVerificationTargets,
  type RestoreVerificationSnapshot,
} from '@/lib/backup/restoreVerification';

export type BackupChangeStatus =
  | 'increased'
  | 'decreased'
  | 'unchanged'
  | 'missing';

export interface BackupChangeEntry {
  key: string;
  modelName: string;
  coverage: BackupCoverageClass;
  backupCount: number;
  currentCount: number;
  delta: number;
  status: BackupChangeStatus;
  reason?: 'table-missing';
}

export interface BackupChangesComparison {
  backupTimestamp: string;
  backupCreatedAt: string | null;
  backupStrategy: 'full' | 'differential' | 'log';
  currentGeneratedAt: string;
  totalTables: number;
  changedTables: number;
  increasedTables: number;
  decreasedTables: number;
  missingTables: number;
  unchangedTables: number;
  backupTotalRecords: number;
  currentTotalRecords: number;
  deltaRecords: number;
  entries: BackupChangeEntry[];
}

type BuildBackupChangesComparisonInput = {
  backupTimestamp: string;
  backupCreatedAt?: string | null;
  backupStrategy?: 'full' | 'differential' | 'log';
  backupRecordCounts: Record<string, number>;
  liveSnapshot: RestoreVerificationSnapshot;
};

function getStatusPriority(status: BackupChangeStatus) {
  switch (status) {
    case 'missing':
      return 0;
    case 'increased':
    case 'decreased':
      return 1;
    case 'unchanged':
    default:
      return 2;
  }
}

export function buildBackupChangesComparison({
  backupTimestamp,
  backupCreatedAt = null,
  backupStrategy = 'full',
  backupRecordCounts,
  liveSnapshot,
}: BuildBackupChangesComparisonInput) {
  const liveRecordCounts = buildRecordCountsFromSnapshot(liveSnapshot);
  const targetMetaByKey = new Map(
    getRestoreVerificationTargets().map((target) => [target.key, target])
  );
  const skippedByKey = new Map(
    (liveSnapshot.skippedEntries ?? []).map((entry) => [entry.key, entry])
  );

  const keys = Array.from(
    new Set([
      ...Object.keys(backupRecordCounts),
      ...Object.keys(liveRecordCounts),
      ...Array.from(skippedByKey.keys()),
    ])
  );

  const entries = keys
    .map((key) => {
      const target = targetMetaByKey.get(key);
      const skipped = skippedByKey.get(key);
      const backupCount = backupRecordCounts[key] ?? 0;
      const currentCount = liveRecordCounts[key] ?? 0;
      const delta = currentCount - backupCount;

      let status: BackupChangeStatus = 'unchanged';
      if (skipped) {
        status = 'missing';
      } else if (delta > 0) {
        status = 'increased';
      } else if (delta < 0) {
        status = 'decreased';
      }

      return {
        key,
        modelName: target?.modelName ?? key,
        coverage: target?.coverage ?? 'dump-only',
        backupCount,
        currentCount,
        delta,
        status,
        reason: skipped?.reason,
      } satisfies BackupChangeEntry;
    })
    .sort((left, right) => {
      const priority =
        getStatusPriority(left.status) - getStatusPriority(right.status);
      if (priority !== 0) {
        return priority;
      }

      const deltaOrder = Math.abs(right.delta) - Math.abs(left.delta);
      if (deltaOrder !== 0) {
        return deltaOrder;
      }

      return left.key.localeCompare(right.key);
    });

  const increasedTables = entries.filter(
    (entry) => entry.status === 'increased'
  ).length;
  const decreasedTables = entries.filter(
    (entry) => entry.status === 'decreased'
  ).length;
  const missingTables = entries.filter(
    (entry) => entry.status === 'missing'
  ).length;
  const unchangedTables = entries.filter(
    (entry) => entry.status === 'unchanged'
  ).length;
  const changedTables = entries.length - unchangedTables;
  const backupTotalRecords = entries.reduce(
    (sum, entry) => sum + entry.backupCount,
    0
  );
  const currentTotalRecords = entries.reduce(
    (sum, entry) => sum + entry.currentCount,
    0
  );

  return {
    backupTimestamp,
    backupCreatedAt,
    backupStrategy,
    currentGeneratedAt: liveSnapshot.generatedAt,
    totalTables: entries.length,
    changedTables,
    increasedTables,
    decreasedTables,
    missingTables,
    unchangedTables,
    backupTotalRecords,
    currentTotalRecords,
    deltaRecords: currentTotalRecords - backupTotalRecords,
    entries,
  } satisfies BackupChangesComparison;
}
