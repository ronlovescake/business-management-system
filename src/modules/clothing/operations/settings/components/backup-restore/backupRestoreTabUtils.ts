import type { BackupData, RestorePreviewResults } from '../../backup/types';
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

type RestorePreviewEntry = RestorePreviewResults[string];

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
