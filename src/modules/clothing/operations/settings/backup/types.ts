import { formatDateTime } from '@/lib/formatters';

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
  scheduler?: {
    trigger: 'manual' | 'scheduled';
    triggeredAt: string;
    scheduleTime?: string;
    scheduleCadence?: 'daily' | 'weekly';
    scheduleDayOfWeek?: string;
    timeZone?: string;
    scheduledDateKey?: string;
    catchUp?: boolean;
    missedDateKeys?: string[];
  };
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
      data?: Array<Record<string, unknown>>;
      sample?: {
        offset: number;
        limit: number;
        total: number;
      };
    }
  >;
}

export type RestorePlanStatus = 'ready' | 'advisory' | 'invalid';

export type RestorePlanStepAction =
  | 'restore-full-dump'
  | 'apply-differential-json'
  | 'apply-log-json';

export interface RestorePlanStep {
  folder: string;
  timestamp: string;
  strategy: BackupStrategy;
  format: string;
  action: RestorePlanStepAction;
  supported: boolean;
  artifactName?: string;
  artifactPath?: string;
  reason?: string;
}

export interface RestorePlan {
  status: RestorePlanStatus;
  targetFolder: string;
  targetTimestamp: string;
  targetStrategy: BackupStrategy;
  chainFolders: string[];
  steps: RestorePlanStep[];
  warnings: string[];
  errors: string[];
  requiresReplayEngine: boolean;
  disasterRecoveryReady: boolean;
}

export type RestoreJobPhase = 'pending' | 'running' | 'succeeded' | 'failed';

export type BackupChangeStatus =
  | 'increased'
  | 'decreased'
  | 'unchanged'
  | 'missing';

export type BackupCoverageClass = 'selective-json' | 'log-only' | 'dump-only';

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
  backupStrategy: BackupStrategy;
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

export type BackupChangePreviewType = 'added' | 'updated' | 'removed';

export interface BackupChangePreview {
  table: string;
  backupCount: number;
  currentCount: number;
  addedCount: number;
  added: Array<Record<string, unknown>>;
  truncatedAdded?: boolean;
  updatedCount: number;
  updates: Array<{
    id: number | string | null;
    changes: Record<string, { before: unknown; after: unknown }>;
    backup: Record<string, unknown>;
    current: Record<string, unknown>;
  }>;
  truncatedUpdates?: boolean;
  removedCount: number;
  removed: Array<Record<string, unknown>>;
  truncatedRemoved?: boolean;
}

export interface RestoreJobStatus {
  id: string;
  scope: 'full-dump';
  phase: RestoreJobPhase;
  backupFolder: string;
  dumpArtifactPath: string;
  dumpFileName: string;
  manifestTimestamp: string;
  requestedAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  message?: string;
  error?: string;
}

export interface PitrBaseBackupFile {
  name: string;
  path: string;
  size: number;
}

export interface PitrWalFile {
  name: string;
  size: number;
  /** ISO-8601 modification time from the filesystem */
  mtime?: string;
}

export interface PitrBaseBackup {
  folder: string;
  timestamp: string;
  createdAt: string;
  database: string;
  host: string;
  port: string;
  label: string;
  scheduler?: {
    trigger: 'manual' | 'scheduled';
    triggeredAt: string;
    scheduleTime?: string;
    timeZone?: string;
    scheduledDateKey?: string;
    catchUp?: boolean;
    missedDateKeys?: string[];
  };
  files: PitrBaseBackupFile[];
  totalSize: number;
}

export interface PitrRuntimeStatus {
  archiveMode: string | null;
  archiveCommand: string | null;
  archiveTimeout: string | null;
  walLevel: string | null;
  archivedCount: number;
  failedCount: number;
  lastArchivedWal: string | null;
  lastArchivedAt: string | null;
  lastFailedWal: string | null;
  lastFailedAt: string | null;
  statsResetAt: string | null;
  databaseConnected: boolean;
  error?: string;
}

export interface PitrStatus {
  enabled: boolean;
  baseBackupDirectory: string;
  walArchiveDirectory: string;
  schedule: {
    enabled: boolean;
    time: string | null;
    timeZone: string | null;
  };
  baseBackupCount: number;
  latestBaseBackup: PitrBaseBackup | null;
  walArchiveFileCount: number;
  walArchiveTotalSize: number;
  latestArchivedWalFile: string | null;
  latestArchivedWalMtime: string | null;
  runtime: PitrRuntimeStatus;
  recoveryWindow: {
    start: string | null;
    end: string | null;
  };
  restoreCommandPreview: string | null;
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
    insertCount?: number;
    inserts: Array<Record<string, unknown>>;
    truncatedInserts?: boolean;
    updateCount?: number;
    updates: Array<{
      id: number | string | null;
      changes: Record<string, { before: unknown; after: unknown }>;
      incoming: Record<string, unknown>;
      existing?: Record<string, unknown>;
    }>;
    truncatedUpdates?: boolean;
    skipped: number;
    notice?: string;
    deletedCount?: number;
  }
>;

export const STRATEGY_META: Record<
  BackupStrategy,
  { label: string; color: string; cadence: string }
> = {
  full: { label: 'Full', color: 'indigo', cadence: 'Weekly restore-ready dump' },
  differential: {
    label: 'Differential',
    color: 'grape',
    cadence: 'Daily changes since last full baseline',
  },
  log: {
    label: 'Log',
    color: 'cyan',
    cadence: 'Manual JSON change capture',
  },
};

export const STRATEGY_SEQUENCE: BackupStrategy[] = [
  'full',
  'differential',
  'log',
];

export const TIMESTAMP_FOLDER_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(-(?:full|differential|log)-backup)?$/;

export const normalizeTimestamp = (timestamp: string) => {
  if (TIMESTAMP_FOLDER_REGEX.test(timestamp)) {
    const bare = timestamp.replace(/-(full|differential|log)-backup$/, '');
    return bare.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3Z');
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
  const insertCount = entry.insertCount ?? entry.inserts.length;
  const updateCount = entry.updateCount ?? entry.updates.length;
  if (forceOverwrite) {
    return insertCount > 0 || (entry.deletedCount ?? 0) > 0;
  }
  return insertCount > 0 || updateCount > 0;
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
    return formatDateTime(date, {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
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
