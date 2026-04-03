import {
  getChangedFields,
  normalizeRecord,
  recordsMatch,
  type RowRecord,
} from '@/app/api/restore/restorePreviewUtils';

export const BACKUP_CHANGE_PREVIEW_MAX_ROWS = 2000;
export const BACKUP_CHANGE_PREVIEW_SAMPLE_LIMIT = 100;

export interface BackupChangePreviewUpdate {
  id: number | string | null;
  changes: Record<string, { before: unknown; after: unknown }>;
  backup: RowRecord;
  current: RowRecord;
}

export interface BackupChangePreviewResult {
  table: string;
  backupCount: number;
  currentCount: number;
  addedCount: number;
  added: RowRecord[];
  truncatedAdded?: boolean;
  updatedCount: number;
  updates: BackupChangePreviewUpdate[];
  truncatedUpdates?: boolean;
  removedCount: number;
  removed: RowRecord[];
  truncatedRemoved?: boolean;
}

function getRowId(row: RowRecord, table: string, source: 'backup' | 'current') {
  const id = row.id as number | string | null | undefined;
  if (id === null || id === undefined || id === '') {
    throw new Error(
      `Detailed change preview requires stable IDs. Table ${table} has a ${source} row without an id.`
    );
  }

  return id;
}

function buildRowMap(
  rows: RowRecord[],
  table: string,
  source: 'backup' | 'current'
) {
  const map = new Map<number | string, RowRecord>();

  for (const rawRow of rows) {
    const row = normalizeRecord(rawRow);
    const id = getRowId(row, table, source);

    if (map.has(id)) {
      throw new Error(
        `Detailed change preview requires unique IDs. Table ${table} has duplicate ${source} id ${String(id)}.`
      );
    }

    map.set(id, row);
  }

  return map;
}

export function buildBackupChangePreview(
  table: string,
  backupRows: RowRecord[],
  currentRows: RowRecord[]
) {
  const backupById = buildRowMap(backupRows, table, 'backup');
  const currentById = buildRowMap(currentRows, table, 'current');

  const preview: BackupChangePreviewResult = {
    table,
    backupCount: backupById.size,
    currentCount: currentById.size,
    addedCount: 0,
    added: [],
    updatedCount: 0,
    updates: [],
    removedCount: 0,
    removed: [],
  };

  for (const [id, current] of Array.from(currentById.entries())) {
    const backup = backupById.get(id);

    if (!backup) {
      preview.addedCount += 1;
      if (preview.added.length < BACKUP_CHANGE_PREVIEW_SAMPLE_LIMIT) {
        preview.added.push(current);
      } else {
        preview.truncatedAdded = true;
      }
      continue;
    }

    if (recordsMatch(backup, current)) {
      continue;
    }

    preview.updatedCount += 1;
    if (preview.updates.length < BACKUP_CHANGE_PREVIEW_SAMPLE_LIMIT) {
      preview.updates.push({
        id,
        changes: getChangedFields(backup, current),
        backup,
        current,
      });
    } else {
      preview.truncatedUpdates = true;
    }
  }

  for (const [id, backup] of Array.from(backupById.entries())) {
    if (currentById.has(id)) {
      continue;
    }

    preview.removedCount += 1;
    if (preview.removed.length < BACKUP_CHANGE_PREVIEW_SAMPLE_LIMIT) {
      preview.removed.push(backup);
    } else {
      preview.truncatedRemoved = true;
    }
  }

  return preview;
}
