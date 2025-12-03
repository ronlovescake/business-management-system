export type BackupStrategy = 'full' | 'differential' | 'log';

export interface BackupManifest {
  timestamp?: string;
  database?: string;
  format?: string;
  version?: string;
  strategy?: BackupStrategy;
  includeSoftDeleted?: boolean;
  baseTimestamp?: string | null;
  baseFolder?: string | null;
  changeWindow?: {
    since: string | null;
    until: string;
  } | null;
  files?: Array<{
    name: string;
    size: number;
    path: string;
  }>;
  recordCounts?: Record<string, number>;
  differentialFallbackTables?: string[];
}

export interface Backup {
  timestamp: string;
  path: string;
  files: string[];
  totalSize: number;
  manifest?: BackupManifest | null;
  strategy?: BackupStrategy;
}

export interface BackupData {
  metadata: {
    createdAt: string;
    database: string;
    format: string;
    version: string;
    strategy?: BackupStrategy;
    baseTimestamp?: string | null;
    baseFolder?: string | null;
    changeWindow?: {
      since: string | null;
      until: string;
    } | null;
    includeSoftDeleted?: boolean;
  };
  tables: Record<
    string,
    {
      count: number;
      data: Array<Record<string, unknown>>;
    }
  >;
}

export type RestoreResults = Record<
  string,
  {
    count: number;
    updated?: number;
    error?: string;
    beforeCount?: number;
    afterCount?: number;
    attempted?: number;
    skipped?: number;
  }
>;

export type RestorePreviewResults = Record<
  string,
  {
    attempted: number;
    inserts: Array<Record<string, unknown>>;
    updates: Array<{
      id: number | string | null;
      changes: Record<string, { before: unknown; after: unknown }>;
      incoming: Record<string, unknown>;
      existing?: Record<string, unknown>;
    }>;
    skipped: number;
    notice?: string;
    deletedCount?: number;
  }
>;

export const STRATEGY_META: Record<
  BackupStrategy,
  { label: string; color: string; cadence: string }
> = {
  full: { label: 'Full', color: 'indigo', cadence: 'Weekly baseline' },
  differential: {
    label: 'Differential',
    color: 'grape',
    cadence: 'Daily changes since last full',
  },
  log: {
    label: 'Log',
    color: 'cyan',
    cadence: 'Continuous change stream',
  },
};

export const STRATEGY_SEQUENCE: BackupStrategy[] = [
  'full',
  'differential',
  'log',
];

export const TIMESTAMP_FOLDER_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;

export const normalizeTimestamp = (timestamp: string) => {
  if (TIMESTAMP_FOLDER_REGEX.test(timestamp)) {
    return timestamp.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3Z');
  }
  return timestamp;
};

export const parseTimestamp = (timestamp?: string | null) => {
  if (!timestamp) {
    return null;
  }
  const normalized = normalizeTimestamp(timestamp);
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const relativeFormatter = new Intl.RelativeTimeFormat('en', {
  numeric: 'auto',
});

export const formatRelativeTime = (date: Date | null) => {
  if (!date) {
    return 'Never';
  }

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / (60 * 1000));

  if (Math.abs(minutes) < 60) {
    return relativeFormatter.format(-minutes, 'minute');
  }

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return relativeFormatter.format(-hours, 'hour');
  }

  const days = Math.round(hours / 24);
  return relativeFormatter.format(-days, 'day');
};

export const formatCellValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
};

const PREVIEW_FIELD_HINTS = [
  'customers',
  'name',
  'productCode',
  'orderDate',
  'notes',
  'description',
  'title',
  'email',
  'reference',
  'shipmentCode',
];

export const guessRowLabel = (
  row: Record<string, unknown>,
  fallback: string
): string => {
  const label = PREVIEW_FIELD_HINTS.find((field) => {
    const raw = row[field];
    return typeof raw === 'string' && raw.trim().length > 0;
  });

  if (label) {
    const value = row[label];
    return `${String(value)}${row.id ? ` (ID ${row.id})` : ''}`;
  }

  if (row.id !== null && row.id !== undefined) {
    return `ID ${row.id}`;
  }

  return fallback;
};

export const createRowKey = (tableName: string, row: Record<string, unknown>) =>
  `${tableName}-${Object.entries(row)
    .slice(0, 5)
    .map(([key, value]) => `${key}:${String(value ?? '')}`)
    .join('|')}`;

export const createCellKey = (rowKey: string, columnKey: string) =>
  `${rowKey}-${columnKey}`;

export const hasTableChanges = (
  preview: RestorePreviewResults | null,
  table: string,
  forceOverwrite: boolean
) => {
  if (!preview) {
    return false;
  }
  const entry = preview[table];
  if (!entry) {
    return false;
  }
  if (forceOverwrite) {
    return entry.inserts.length > 0 || (entry.deletedCount ?? 0) > 0;
  }
  return entry.inserts.length > 0 || entry.updates.length > 0;
};

export const previewHasChanges = (
  preview: RestorePreviewResults | null,
  tables: string[],
  forceOverwrite: boolean
) => tables.some((table) => hasTableChanges(preview, table, forceOverwrite));

export const formatBackupTimestamp = (timestamp: string) => {
  try {
    const date = parseTimestamp(timestamp);
    if (!date) {
      return timestamp;
    }
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  } catch {
    return timestamp;
  }
};

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};
