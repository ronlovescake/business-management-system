import type {
  BackupChangePreview,
  BackupData,
  RestorePreviewResults,
} from '../../backup/types';
import { guessRowLabel } from '../../backup/types';

type SidebarTableSummary = { name: string; count: number };

type SortableValue = number | string | Date | null | undefined;

type SelectedTableDetails = {
  name: string;
  count: number;
  data: Array<Record<string, unknown>>;
  columns: string[];
};

type RestorePreviewChangeType = 'insert' | 'update';
type BackupChangePreviewType = 'added' | 'updated' | 'removed';

type RestorePreviewEntry = RestorePreviewResults[string];
type BackupChangePreviewEntry = BackupChangePreview;

export const areBackupSidebarTablesEqual = (
  nextTables: SidebarTableSummary[],
  currentTables: SidebarTableSummary[]
) => {
  if (nextTables.length !== currentTables.length) {
    return false;
  }

  for (let i = 0; i < nextTables.length; i += 1) {
    const next = nextTables[i];
    const current = currentTables[i];
    if (
      !current ||
      next.name !== current.name ||
      next.count !== current.count
    ) {
      return false;
    }
  }

  return true;
};

const parseSortValue = (value: SortableValue) => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && value.trim() !== '') {
      return numeric;
    }
    const date = Date.parse(value);
    if (!Number.isNaN(date)) {
      return date;
    }
    return value.toLowerCase();
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  return value ?? 0;
};

const sortTableRows = (rows: Array<Record<string, unknown>>) => {
  if (!rows.length) {
    return rows;
  }

  const preferredKeys = ['createdAt', 'updatedAt', 'orderDate', 'id'];
  const sortKey = preferredKeys.find((key) =>
    rows.some((row) => row[key] !== undefined)
  );

  if (!sortKey) {
    return rows;
  }

  return [...rows].sort((a, b) => {
    const aValue = parseSortValue(a[sortKey] as SortableValue);
    const bValue = parseSortValue(b[sortKey] as SortableValue);

    if (aValue < bValue) {
      return -1;
    }
    if (aValue > bValue) {
      return 1;
    }
    return 0;
  });
};

export const getSelectedTableDetails = (
  previewData: BackupData | null,
  selectedTableName: string | null
): SelectedTableDetails | null => {
  if (!previewData || !selectedTableName) {
    return null;
  }

  const table = previewData.tables[selectedTableName];
  if (!table || !table.data) {
    return null;
  }

  const columns: string[] = [];
  table.data.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!columns.includes(key)) {
        columns.push(key);
      }
    });
  });

  return {
    name: selectedTableName,
    count: table.count,
    data: sortTableRows(table.data),
    columns,
  };
};

export const getRestorePreviewTableOptions = (
  restorePreviewData: RestorePreviewResults | null,
  restorePreviewTables: string[],
  restorePreviewForceOverwrite: boolean
) => {
  if (!restorePreviewData || !restorePreviewTables.length) {
    return [];
  }

  return restorePreviewTables
    .filter((table) => restorePreviewData[table])
    .map((table) => {
      const entry = restorePreviewData[table];
      const insertCount = entry
        ? (entry.insertCount ?? entry.inserts.length)
        : 0;
      const updateCount = restorePreviewForceOverwrite
        ? 0
        : entry
          ? (entry.updateCount ?? entry.updates.length)
          : 0;
      const labels: string[] = [];

      if (insertCount) {
        labels.push(`${insertCount} insert${insertCount === 1 ? '' : 's'}`);
      }
      if (updateCount) {
        labels.push(`${updateCount} update${updateCount === 1 ? '' : 's'}`);
      }
      if (!labels.length) {
        labels.push('no changes');
      }

      return {
        value: table,
        label: `${table} — ${labels.join(', ')}`,
      };
    });
};

export const getRestorePreviewChangeTypeOptions = (
  restorePreviewEntry: RestorePreviewEntry | null,
  restorePreviewForceOverwrite: boolean
) => {
  if (!restorePreviewEntry) {
    return [];
  }

  const options: Array<{ value: RestorePreviewChangeType; label: string }> = [];
  const insertCount =
    restorePreviewEntry.insertCount ?? restorePreviewEntry.inserts.length;
  const updateCount =
    restorePreviewEntry.updateCount ?? restorePreviewEntry.updates.length;

  if (insertCount > 0) {
    options.push({
      value: 'insert',
      label: `New rows (${insertCount})`,
    });
  }
  if (!restorePreviewForceOverwrite && updateCount > 0) {
    options.push({
      value: 'update',
      label: `Updates (${updateCount})`,
    });
  }
  if (!options.length) {
    options.push({ value: 'insert', label: 'No changes detected' });
  }

  return options;
};

export const getRestorePreviewRowOptions = (
  restorePreviewEntry: RestorePreviewEntry | null,
  restorePreviewChangeType: RestorePreviewChangeType,
  restorePreviewForceOverwrite: boolean
) => {
  if (!restorePreviewEntry) {
    return [];
  }

  if (restorePreviewChangeType === 'insert' || restorePreviewForceOverwrite) {
    return restorePreviewEntry.inserts.map((row, index) => ({
      value: String(index),
      label: guessRowLabel(row, `Row ${index + 1}`),
    }));
  }

  return restorePreviewEntry.updates.map((row, index) => ({
    value: String(index),
    label: guessRowLabel(row.incoming, `Row ${index + 1}`),
  }));
};

export const getRestorePreviewSelectedRowData = (
  restorePreviewEntry: RestorePreviewEntry | null,
  restorePreviewSelectedRow: string | null,
  restorePreviewChangeType: RestorePreviewChangeType,
  restorePreviewForceOverwrite: boolean
) => {
  if (!restorePreviewEntry || restorePreviewSelectedRow === null) {
    return null;
  }

  const index = Number(restorePreviewSelectedRow);
  if (Number.isNaN(index)) {
    return null;
  }

  if (restorePreviewChangeType === 'insert' || restorePreviewForceOverwrite) {
    return {
      type: 'insert' as const,
      row: restorePreviewEntry.inserts[index] ?? null,
    };
  }

  return {
    type: 'update' as const,
    row: restorePreviewEntry.updates[index] ?? null,
  };
};

export const getBackupChangePreviewTypeOptions = (
  preview: BackupChangePreviewEntry | null
) => {
  if (!preview) {
    return [];
  }

  const options: Array<{ value: BackupChangePreviewType; label: string }> = [];

  if (preview.addedCount > 0) {
    options.push({
      value: 'added',
      label: `Added rows (${preview.addedCount})`,
    });
  }
  if (preview.updatedCount > 0) {
    options.push({
      value: 'updated',
      label: `Updated rows (${preview.updatedCount})`,
    });
  }
  if (preview.removedCount > 0) {
    options.push({
      value: 'removed',
      label: `Removed rows (${preview.removedCount})`,
    });
  }

  if (!options.length) {
    options.push({ value: 'added', label: 'No row changes detected' });
  }

  return options;
};

export const getBackupChangePreviewRowOptions = (
  preview: BackupChangePreviewEntry | null,
  changeType: BackupChangePreviewType
) => {
  if (!preview) {
    return [];
  }

  if (changeType === 'added') {
    return preview.added.map((row, index) => ({
      value: String(index),
      label: guessRowLabel(row, `Added row ${index + 1}`),
    }));
  }

  if (changeType === 'removed') {
    return preview.removed.map((row, index) => ({
      value: String(index),
      label: guessRowLabel(row, `Removed row ${index + 1}`),
    }));
  }

  return preview.updates.map((row, index) => ({
    value: String(index),
    label: guessRowLabel(
      row.current ?? row.backup ?? {},
      `Updated row ${index + 1}`
    ),
  }));
};

export const getBackupChangePreviewSelectedRowData = (
  preview: BackupChangePreviewEntry | null,
  selectedRow: string | null,
  changeType: BackupChangePreviewType
) => {
  if (!preview || selectedRow === null) {
    return null;
  }

  const index = Number(selectedRow);
  if (Number.isNaN(index)) {
    return null;
  }

  if (changeType === 'added') {
    return {
      type: 'added' as const,
      row: preview.added[index] ?? null,
    };
  }

  if (changeType === 'removed') {
    return {
      type: 'removed' as const,
      row: preview.removed[index] ?? null,
    };
  }

  return {
    type: 'updated' as const,
    row: preview.updates[index] ?? null,
  };
};

export const getAllRestoreTables = (previewData: BackupData | null) => {
  if (!previewData) {
    return [];
  }
  return Object.keys(previewData.tables);
};

export const toggleRestoreTableSelection = (
  currentSelection: string[],
  table: string,
  isChecked: boolean
) => {
  if (isChecked) {
    if (currentSelection.includes(table)) {
      return currentSelection;
    }
    return [...currentSelection, table];
  }
  return currentSelection.filter((selectedTable) => selectedTable !== table);
};

export const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 30000
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(
      new DOMException(
        `Request timed out after ${Math.round(timeoutMs / 1000)}s`,
        'TimeoutError'
      )
    );
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

export const buildBackupTableSampleUrl = (
  timestamp: string,
  jsonFile: string,
  table: string,
  limit: number,
  offset: number
) =>
  `/api/backup/${encodeURIComponent(timestamp)}/${encodeURIComponent(jsonFile)}?mode=table&table=${encodeURIComponent(table)}&limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`;

type FetchTableSample = (
  timestamp: string,
  jsonFile: string,
  table: string,
  options?: { limit?: number; offset?: number }
) => Promise<BackupData>;

type ResolveExportRowsArgs = {
  previewData: BackupData;
  tableName: string;
  maxRows: number;
  selectedBackupTimestamp: string | null;
  previewJsonFile: string | null;
  fetchTableSample: FetchTableSample;
};

type ResolveExportRowsResult = {
  rows: Array<Record<string, unknown>>;
  tooLarge: boolean;
  missingContext: boolean;
};

export const resolveRowsForClientExport = async ({
  previewData,
  tableName,
  maxRows,
  selectedBackupTimestamp,
  previewJsonFile,
  fetchTableSample,
}: ResolveExportRowsArgs): Promise<ResolveExportRowsResult> => {
  const tableData = previewData.tables[tableName];
  if (!tableData || !tableData.count) {
    return { rows: [], tooLarge: false, missingContext: false };
  }

  if (tableData.count > maxRows) {
    return { rows: [], tooLarge: true, missingContext: false };
  }

  if (tableData.data && tableData.data.length === tableData.count) {
    return {
      rows: tableData.data,
      tooLarge: false,
      missingContext: false,
    };
  }

  if (!selectedBackupTimestamp || !previewJsonFile) {
    return { rows: [], tooLarge: false, missingContext: true };
  }

  const payload = await fetchTableSample(
    selectedBackupTimestamp,
    previewJsonFile,
    tableName,
    {
      limit: tableData.count,
      offset: 0,
    }
  );

  return {
    rows: payload.tables?.[tableName]?.data ?? [],
    tooLarge: false,
    missingContext: false,
  };
};

export const downloadTextFile = (
  content: string,
  type: string,
  fileName: string
) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};
