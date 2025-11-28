'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Stack,
  Box,
  Group,
  Button,
  Card,
  Text,
  Title,
  Badge,
  Select,
  Switch,
  Table as MantineTable,
  ActionIcon,
  Modal,
  Alert,
  Progress,
  Divider,
  ScrollArea,
  Tabs,
  NumberInput,
  Checkbox,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import Swal from 'sweetalert2';
import { api } from '@/lib/api/client';
import {
  IconDatabase,
  IconDownload,
  IconTrash,
  IconClock,
  IconFileTypeCsv,
  IconRefresh,
  IconAlertCircle,
  IconCheck,
  IconFile,
  IconEye,
  IconFileText,
  IconFileSpreadsheet,
  IconHistory,
  IconTable,
} from '@tabler/icons-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

type BackupStrategy = 'full' | 'differential' | 'log';

interface BackupManifest {
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

interface Backup {
  timestamp: string;
  path: string;
  files: string[];
  totalSize: number;
  manifest?: BackupManifest | null;
  strategy?: BackupStrategy;
}

interface BackupData {
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

// Derive stable keys for preview table rows/cells using serialized content
const createRowKey = (tableName: string, row: Record<string, unknown>) =>
  `${tableName}-${Object.entries(row)
    .slice(0, 5)
    .map(([key, value]) => `${key}:${String(value ?? '')}`)
    .join('|')}`;

const createCellKey = (rowKey: string, columnKey: string) =>
  `${rowKey}-${columnKey}`;

const STRATEGY_META: Record<
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

const STRATEGY_SEQUENCE: BackupStrategy[] = ['full', 'differential', 'log'];

const TIMESTAMP_FOLDER_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;

const normalizeTimestamp = (timestamp: string) => {
  if (TIMESTAMP_FOLDER_REGEX.test(timestamp)) {
    return timestamp.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3Z');
  }
  return timestamp;
};

const parseTimestamp = (timestamp?: string | null) => {
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

const formatRelativeTime = (date: Date | null) => {
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

const formatCellValue = (value: unknown) => {
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

type RestoreResults = Record<
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

type RestorePreviewResults = Record<
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

const guessRowLabel = (
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

const hasTableChanges = (
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

const previewHasChanges = (
  preview: RestorePreviewResults | null,
  tables: string[],
  forceOverwrite: boolean
) => tables.some((table) => hasTableChanges(preview, table, forceOverwrite));

export function BackupRestoreTab() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [backupFormat, setBackupFormat] = useState<string>('all');
  const [backupStrategy, setBackupStrategy] = useState<BackupStrategy>('full');
  const [includeSoftDeleted, setIncludeSoftDeleted] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupInterval, setAutoBackupInterval] = useState(30);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<BackupData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(
    null
  );
  const [previewJsonFile, setPreviewJsonFile] = useState<string | null>(null);
  const [restoreSelection, setRestoreSelection] = useState<string[]>([]);
  const [forceOverwrite, setForceOverwrite] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreResults, setRestoreResults] = useState<RestoreResults | null>(
    null
  );
  const [restorePreviewData, setRestorePreviewData] =
    useState<RestorePreviewResults | null>(null);
  const [restorePreviewModalOpen, setRestorePreviewModalOpen] = useState(false);
  const [restorePreviewTables, setRestorePreviewTables] = useState<string[]>(
    []
  );
  const [restorePreviewForceOverwrite, setRestorePreviewForceOverwrite] =
    useState(false);
  const [restorePreviewSelectedTable, setRestorePreviewSelectedTable] =
    useState<string | null>(null);
  const [restorePreviewChangeType, setRestorePreviewChangeType] = useState<
    'insert' | 'update'
  >('insert');
  const [restorePreviewSelectedRow, setRestorePreviewSelectedRow] = useState<
    string | null
  >(null);
  const [pageTab, setPageTab] = useState<'backup' | 'restore' | 'tables'>(
    'backup'
  );
  const autoBackupIntervalRef = useRef<NodeJS.Timeout>();
  const strategyOptions = useMemo(
    () =>
      (Object.keys(STRATEGY_META) as BackupStrategy[]).map((key) => ({
        value: key,
        label: `${STRATEGY_META[key].label} — ${STRATEGY_META[key].cadence}`,
      })),
    []
  );
  const isLogStrategy = backupStrategy === 'log';

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ success: boolean; backups?: Backup[] }>(
        '/api/backup'
      );
      if (data.success) {
        setBackups(data.backups || []);
      }
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'Failed to load backups',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBackups();
  }, [fetchBackups]);

  useEffect(() => {
    if (!previewData?.tables) {
      if (selectedTableName !== null) {
        setSelectedTableName(null);
      }
      return;
    }

    const tableNames = Object.keys(previewData.tables);
    if (!tableNames.length) {
      if (selectedTableName !== null) {
        setSelectedTableName(null);
      }
      return;
    }

    if (!selectedTableName || !previewData.tables[selectedTableName]) {
      setSelectedTableName(tableNames[0]);
    }
  }, [previewData, selectedTableName]);

  const handleCreateBackup = useCallback(
    async ({
      isAuto = false,
      strategy: strategyOverride,
    }: { isAuto?: boolean; strategy?: BackupStrategy } = {}) => {
      if (!isAuto) {
        setCreating(true);
      }

      const strategyToUse = strategyOverride ?? backupStrategy;
      const formatToUse = strategyToUse === 'log' ? 'json' : backupFormat;

      try {
        const data = await api.post<{
          success: boolean;
          backup?: {
            totalSize: number;
            timestamp: string;
            files: string[];
            strategy?: BackupStrategy;
          };
          error?: string;
        }>('/api/backup', {
          format: formatToUse,
          includeSoftDeleted,
          strategy: strategyToUse,
        });

        if (data.success && data.backup) {
          const strategyMeta = STRATEGY_META[strategyToUse];
          showNotification({
            title: isAuto
              ? `✅ ${strategyMeta.label} Auto-Backup Complete`
              : `✅ ${strategyMeta.label} Backup Created`,
            message: `${strategyMeta.label} backup saved (${(data.backup.totalSize / 1024 / 1024).toFixed(2)} MB)`,
            color: 'green',
          });
          await fetchBackups();
        } else {
          throw new Error(data.error || 'Backup failed');
        }
      } catch (error) {
        showNotification({
          title: '❌ Backup Failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          color: 'red',
        });
      } finally {
        if (!isAuto) {
          setCreating(false);
        }
      }
    },
    [backupFormat, backupStrategy, includeSoftDeleted, fetchBackups]
  );

  useEffect(() => {
    if (autoBackupEnabled) {
      const performAutoBackup = async () => {
        showNotification({
          title: 'Auto-Backup',
          message: 'Starting automatic backup...',
          color: 'blue',
          autoClose: 3000,
        });
        await handleCreateBackup({ isAuto: true });
      };

      void performAutoBackup();
      autoBackupIntervalRef.current = setInterval(
        () => void performAutoBackup(),
        autoBackupInterval * 60 * 1000
      );

      return () => {
        if (autoBackupIntervalRef.current) {
          clearInterval(autoBackupIntervalRef.current);
        }
      };
    }
  }, [autoBackupEnabled, autoBackupInterval, handleCreateBackup]);

  const handleDeleteBackup = async (timestamp: string) => {
    const firstStep = await Swal.fire({
      title: 'Delete this backup?',
      text: 'This will permanently remove the backup files.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e03131',
      cancelButtonColor: '#868e96',
      focusCancel: true,
      allowOutsideClick: false,
    });

    if (!firstStep.isConfirmed) {
      return;
    }

    const formattedDate = formatDate(timestamp);
    const finalStep = await Swal.fire({
      title: 'Final confirmation',
      html: `Backup <strong>${formattedDate}</strong> will be deleted.<br/>This action cannot be undone.`,
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: 'Delete backup',
      cancelButtonText: 'Keep backup',
      confirmButtonColor: '#c92a2a',
      cancelButtonColor: '#228be6',
      allowOutsideClick: false,
    });

    if (!finalStep.isConfirmed) {
      return;
    }

    try {
      const data = await api.delete<{ success: boolean; error?: string }>(
        `/api/backup?timestamp=${encodeURIComponent(timestamp)}`
      );

      if (data.success) {
        showNotification({
          title: '✅ Deleted',
          message: 'Backup deleted',
          color: 'green',
        });
        await fetchBackups();
      }
    } catch (error) {
      showNotification({
        title: '❌ Delete Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handlePreviewBackup = async (backup: Backup) => {
    setSelectedBackup(backup);
    const shouldOpenModal = pageTab !== 'tables';
    setPreviewModalOpen(shouldOpenModal);
    setPreviewLoading(true);
    setRestoreResults(null);

    try {
      const jsonFile =
        backup.files.find(
          (f) => f.startsWith('backup-') && f.endsWith('.json')
        ) || backup.files.find((f) => f.endsWith('.json'));
      if (!jsonFile) {
        throw new Error('No JSON file found');
      }

      // Use API route to fetch the file
      const response = await fetch(
        `/api/backup/${backup.timestamp}/${jsonFile}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch backup: ${response.statusText}`);
      }
      const data: BackupData = await response.json();
      setPreviewData(data);
      const [firstTable] = Object.keys(data.tables);
      setSelectedTableName(firstTable ?? null);
      setRestoreSelection([]);
      setForceOverwrite(false);
      setPreviewJsonFile(jsonFile);
    } catch (error) {
      showNotification({
        title: 'Preview Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
      setPreviewModalOpen(false);
      setSelectedTableName(null);
      setPreviewJsonFile(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadJSON = async (backup: Backup) => {
    try {
      const jsonFile =
        backup.files.find(
          (f) => f.startsWith('backup-') && f.endsWith('.json')
        ) || backup.files.find((f) => f.endsWith('.json'));
      if (!jsonFile) {
        return;
      }

      // Use API route to fetch the file
      const response = await fetch(
        `/api/backup/${backup.timestamp}/${jsonFile}`
      );
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = jsonFile;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showNotification({
        title: 'Download Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handleDownloadSQL = async (backup: Backup) => {
    try {
      const sqlFile =
        backup.files.find(
          (f) => f.startsWith('backup-') && f.endsWith('.sql')
        ) || backup.files.find((f) => f.endsWith('.sql'));
      if (!sqlFile) {
        showNotification({
          title: 'No SQL File',
          message: 'This backup does not contain an SQL dump file',
          color: 'orange',
        });
        return;
      }

      // Use API route to fetch the file
      const response = await fetch(
        `/api/backup/${backup.timestamp}/${sqlFile}`
      );
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sqlFile;
      a.click();
      URL.revokeObjectURL(url);

      showNotification({
        title: 'Downloaded',
        message: sqlFile,
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'Download Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handleDownloadXLSX = async (tableName: string) => {
    if (!previewData) {
      return;
    }

    try {
      const tableData = previewData.tables[tableName];
      if (!tableData?.data?.length) {
        return;
      }

      // Create worksheet from table data
      const ws = XLSX.utils.json_to_sheet(tableData.data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, tableName);

      // Generate XLSX file
      XLSX.writeFile(wb, `${tableName}-${selectedBackup?.timestamp}.xlsx`);

      showNotification({
        title: 'Downloaded',
        message: `${tableName}.xlsx`,
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'Download Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handleDownloadAllXLSX = async () => {
    if (!previewData) {
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      let sheetCount = 0;

      for (const [tableName, tableData] of Object.entries(previewData.tables)) {
        if (tableData.data?.length) {
          const ws = XLSX.utils.json_to_sheet(tableData.data);
          // Sheet names are limited to 31 characters in Excel
          const sheetName = tableName.substring(0, 31);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
          sheetCount++;
        }
      }

      if (sheetCount > 0) {
        XLSX.writeFile(
          wb,
          `backup-all-tables-${selectedBackup?.timestamp}.xlsx`
        );
        showNotification({
          title: 'Downloaded',
          message: `${sheetCount} tables in workbook`,
          color: 'green',
        });
      }
    } catch (error) {
      showNotification({
        title: 'Download Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handleDownloadCSV = async (tableName: string) => {
    if (!previewData) {
      return;
    }

    try {
      const tableData = previewData.tables[tableName];
      if (!tableData?.data?.length) {
        return;
      }

      const csv = Papa.unparse(tableData.data);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tableName}-${selectedBackup?.timestamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      showNotification({
        title: 'Downloaded',
        message: `${tableName}.csv`,
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'Download Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handleDownloadAllCSV = async () => {
    if (!previewData) {
      return;
    }

    let count = 0;
    for (const [tableName, tableData] of Object.entries(previewData.tables)) {
      if (tableData.data?.length) {
        const csv = Papa.unparse(tableData.data);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tableName}-${selectedBackup?.timestamp}.csv`;
        await new Promise((r) => setTimeout(r, 100));
        a.click();
        URL.revokeObjectURL(url);
        count++;
      }
    }

    showNotification({
      title: 'Downloaded',
      message: `${count} CSV files`,
      color: 'green',
    });
  };

  const handleSelectAllTables = () => {
    if (!previewData) {
      return;
    }
    setRestoreSelection(Object.keys(previewData.tables));
  };

  const handleClearSelectedTables = () => {
    setRestoreSelection([]);
  };

  const toggleTableSelection = (table: string, checked: boolean) => {
    setRestoreSelection((prev) => {
      if (checked) {
        if (prev.includes(table)) {
          return prev;
        }
        return [...prev, table];
      }
      return prev.filter((t) => t !== table);
    });
  };

  const handleRestore = useCallback(async () => {
    if (!selectedBackup || !previewJsonFile || !previewData) {
      showNotification({
        title: 'Restore unavailable',
        message: 'Open a backup preview before restoring.',
        color: 'red',
      });
      return;
    }

    const tablesForConfirm = restoreSelection;

    if (!tablesForConfirm.length) {
      showNotification({
        title: 'Select tables',
        message: 'Choose at least one table to restore.',
        color: 'red',
      });
      return;
    }

    setRestorePreviewData(null);
    setRestorePreviewTables([]);
    setRestorePreviewSelectedTable(null);
    setRestorePreviewSelectedRow(null);

    setRestoreLoading(true);

    try {
      const previewResponse = await api.post<{
        success: boolean;
        preview?: RestorePreviewResults;
        error?: string;
      }>('/api/restore', {
        timestamp: selectedBackup.timestamp,
        file: previewJsonFile,
        tables: tablesForConfirm,
        forceOverwrite,
        previewOnly: true,
      });

      if (!previewResponse.success || !previewResponse.preview) {
        throw new Error(previewResponse.error || 'Failed to build preview.');
      }

      if (
        !previewHasChanges(
          previewResponse.preview,
          tablesForConfirm,
          forceOverwrite
        )
      ) {
        showNotification({
          title: 'Up to date',
          message: 'Selected tables already match this backup.',
          color: 'blue',
        });
        return;
      }

      setRestorePreviewData(previewResponse.preview);
      setRestorePreviewTables(tablesForConfirm);
      setRestorePreviewForceOverwrite(forceOverwrite);

      const initialTable =
        tablesForConfirm.find((table) =>
          hasTableChanges(
            previewResponse.preview ?? null,
            table,
            forceOverwrite
          )
        ) ??
        tablesForConfirm[0] ??
        null;

      setRestorePreviewSelectedTable(initialTable ?? null);

      if (initialTable && previewResponse.preview[initialTable]) {
        const entry = previewResponse.preview[initialTable];
        const defaultChangeType =
          entry.inserts.length > 0
            ? 'insert'
            : !forceOverwrite && entry.updates.length > 0
              ? 'update'
              : 'insert';
        setRestorePreviewChangeType(defaultChangeType);
        const rows =
          defaultChangeType === 'insert' ? entry.inserts : entry.updates;
        setRestorePreviewSelectedRow(rows.length ? '0' : null);
      } else {
        setRestorePreviewChangeType('insert');
        setRestorePreviewSelectedRow(null);
      }

      setRestorePreviewModalOpen(true);
    } catch (error) {
      showNotification({
        title: 'Preview unavailable',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setRestoreLoading(false);
    }
  }, [
    selectedBackup,
    previewJsonFile,
    previewData,
    restoreSelection,
    forceOverwrite,
  ]);

  const handleConfirmRestore = useCallback(async () => {
    if (
      !selectedBackup ||
      !previewJsonFile ||
      !previewData ||
      restorePreviewTables.length === 0
    ) {
      showNotification({
        title: 'Restore unavailable',
        message: 'Preview data is missing. Try running the restore again.',
        color: 'red',
      });
      return;
    }

    const tablesForConfirm = restorePreviewTables;
    const formattedDate = formatDate(selectedBackup.timestamp);
    const listHtml = tablesForConfirm
      .map(
        (table) =>
          `<li><strong>${table}</strong> (${previewData.tables[table]?.count ?? 0} rows)</li>`
      )
      .join('');

    const confirmation = await Swal.fire({
      title: 'Restore backup?',
      width: 520,
      html: `
        <div style="text-align: left; font-size: 15px; line-height: 1.5;">
          <p style="font-weight: 600; color: #c92a2a;">You are about to restore these datasets:</p>
          <ul style="margin: 8px 0 18px 20px;">${listHtml}</ul>
          <p>This data comes from backup <strong>${formattedDate}</strong>.</p>
          <p style="margin-top: 10px; color: ${
            restorePreviewForceOverwrite ? '#c92a2a' : '#495057'
          };">
            ${
              restorePreviewForceOverwrite
                ? 'Existing data will be overwritten.'
                : 'Existing data will be preserved when duplicates exist.'
            }
          </p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Restore now',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#228be6',
      cancelButtonColor: '#868e96',
      allowOutsideClick: false,
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    const secondary = await Swal.fire({
      title: 'Type "RESTORE" to confirm',
      input: 'text',
      inputAttributes: {
        autocapitalize: 'off',
      },
      inputPlaceholder: 'RESTORE',
      confirmButtonText: 'Yes, restore',
      confirmButtonColor: '#c92a2a',
      showCancelButton: true,
      cancelButtonColor: '#868e96',
      allowOutsideClick: false,
      preConfirm: (value) => {
        if (value?.trim().toUpperCase() !== 'RESTORE') {
          Swal.showValidationMessage('Please type RESTORE to continue.');
          return false;
        }
        return true;
      },
    });

    if (!secondary.isConfirmed) {
      return;
    }

    setRestorePreviewModalOpen(false);
    setRestoreLoading(true);

    try {
      const response = await api.post<{
        success: boolean;
        results?: RestoreResults;
        error?: string;
        message?: string;
      }>('/api/restore', {
        timestamp: selectedBackup.timestamp,
        file: previewJsonFile,
        tables: tablesForConfirm,
        forceOverwrite: restorePreviewForceOverwrite,
      });

      if (!response.success || !response.results) {
        throw new Error(response.error || 'Restore failed');
      }

      setRestoreResults(response.results);
      showNotification({
        title: 'Restore complete',
        message: `Restored ${tablesForConfirm.length} table${
          tablesForConfirm.length === 1 ? '' : 's'
        }.`,
        color: 'green',
      });
      setRestorePreviewData(null);
      setRestorePreviewTables([]);
      setRestorePreviewSelectedTable(null);
      setRestorePreviewSelectedRow(null);
    } catch (error) {
      showNotification({
        title: 'Restore failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setRestoreLoading(false);
    }
  }, [
    selectedBackup,
    previewJsonFile,
    previewData,
    restorePreviewTables,
    restorePreviewForceOverwrite,
  ]);

  const handleCloseRestorePreviewModal = useCallback(() => {
    if (restoreLoading) {
      return;
    }
    setRestorePreviewModalOpen(false);
    setRestorePreviewData(null);
    setRestorePreviewTables([]);
    setRestorePreviewSelectedTable(null);
    setRestorePreviewSelectedRow(null);
    setRestorePreviewChangeType('insert');
  }, [restoreLoading]);

  useEffect(() => {
    if (
      !restorePreviewModalOpen ||
      !restorePreviewData ||
      !restorePreviewSelectedTable
    ) {
      return;
    }

    const entry = restorePreviewData[restorePreviewSelectedTable];
    if (!entry) {
      setRestorePreviewSelectedRow(null);
      return;
    }

    const hasInserts = entry.inserts.length > 0;
    const hasUpdates =
      !restorePreviewForceOverwrite && entry.updates.length > 0;

    if (restorePreviewChangeType === 'insert' && !hasInserts && hasUpdates) {
      setRestorePreviewChangeType('update');
      return;
    }

    if (restorePreviewChangeType === 'update' && !hasUpdates && hasInserts) {
      setRestorePreviewChangeType('insert');
      return;
    }

    if (!hasInserts && !hasUpdates) {
      setRestorePreviewSelectedRow(null);
      return;
    }

    const rows =
      restorePreviewChangeType === 'insert' ? entry.inserts : entry.updates;

    setRestorePreviewSelectedRow((current) => {
      if (current === null || Number(current) >= rows.length) {
        return '0';
      }
      return current;
    });
  }, [
    restorePreviewModalOpen,
    restorePreviewData,
    restorePreviewSelectedTable,
    restorePreviewChangeType,
    restorePreviewForceOverwrite,
  ]);

  const parseSortValue = useCallback((value: unknown) => {
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
  }, []);

  const sortTableRows = useCallback(
    (rows: Array<Record<string, unknown>>) => {
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
        const aValue = parseSortValue(a[sortKey]);
        const bValue = parseSortValue(b[sortKey]);

        if (aValue < bValue) {
          return -1;
        }
        if (aValue > bValue) {
          return 1;
        }
        return 0;
      });
    },
    [parseSortValue]
  );

  const selectedTableDetails = useMemo(() => {
    if (!previewData || !selectedTableName) {
      return null;
    }

    const table = previewData.tables[selectedTableName];
    if (!table) {
      return null;
    }

    const columns: string[] = [];
    (table.data || []).forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (!columns.includes(key)) {
          columns.push(key);
        }
      });
    });

    return {
      name: selectedTableName,
      count: table.count,
      data: sortTableRows(table.data || []),
      columns,
    };
  }, [previewData, selectedTableName, sortTableRows]);

  const restorePreviewEntry = useMemo(() => {
    if (!restorePreviewSelectedTable || !restorePreviewData) {
      return null;
    }
    return restorePreviewData[restorePreviewSelectedTable] ?? null;
  }, [restorePreviewSelectedTable, restorePreviewData]);

  const restorePreviewTableOptions = useMemo(() => {
    if (!restorePreviewData || !restorePreviewTables.length) {
      return [];
    }

    return restorePreviewTables
      .filter((table) => restorePreviewData[table])
      .map((table) => {
        const entry = restorePreviewData[table];
        const insertCount = entry?.inserts.length ?? 0;
        const updateCount = restorePreviewForceOverwrite
          ? 0
          : (entry?.updates.length ?? 0);
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
  }, [restorePreviewData, restorePreviewTables, restorePreviewForceOverwrite]);

  const restorePreviewChangeTypeOptions = useMemo(() => {
    if (!restorePreviewEntry) {
      return [];
    }
    const options: Array<{ value: 'insert' | 'update'; label: string }> = [];
    if (restorePreviewEntry.inserts.length > 0) {
      options.push({
        value: 'insert',
        label: `New rows (${restorePreviewEntry.inserts.length})`,
      });
    }
    if (
      !restorePreviewForceOverwrite &&
      restorePreviewEntry.updates.length > 0
    ) {
      options.push({
        value: 'update',
        label: `Updates (${restorePreviewEntry.updates.length})`,
      });
    }
    if (!options.length) {
      options.push({ value: 'insert', label: 'No changes detected' });
    }
    return options;
  }, [restorePreviewEntry, restorePreviewForceOverwrite]);

  const restorePreviewRowOptions = useMemo(() => {
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
  }, [
    restorePreviewEntry,
    restorePreviewChangeType,
    restorePreviewForceOverwrite,
  ]);

  const restorePreviewSelectedRowData = useMemo(() => {
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
  }, [
    restorePreviewEntry,
    restorePreviewSelectedRow,
    restorePreviewChangeType,
    restorePreviewForceOverwrite,
  ]);

  const availableTables = previewData ? Object.keys(previewData.tables) : [];
  const restoreDisabled =
    restoreLoading ||
    !selectedBackup ||
    !previewJsonFile ||
    restoreSelection.length === 0;
  const restoreSummaryEntries = restoreResults
    ? Object.entries(restoreResults)
    : [];

  const formatDate = (timestamp: string) => {
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const resolveBackupStrategy = (backup: Backup): BackupStrategy => {
    const manifestStrategy = backup.manifest?.strategy;
    if (
      manifestStrategy === 'differential' ||
      manifestStrategy === 'log' ||
      manifestStrategy === 'full'
    ) {
      return manifestStrategy;
    }

    if (
      backup.strategy === 'differential' ||
      backup.strategy === 'log' ||
      backup.strategy === 'full'
    ) {
      return backup.strategy;
    }

    return 'full';
  };

  const renderPreviewValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') {
      return (
        <Text size="sm" c="dimmed" fs="italic">
          blank
        </Text>
      );
    }

    if (typeof value === 'object') {
      try {
        return (
          <Text size="sm" ff="monospace">
            {JSON.stringify(value)}
          </Text>
        );
      } catch {
        return (
          <Text size="sm" ff="monospace">
            [object]
          </Text>
        );
      }
    }

    return (
      <Text size="sm" ff="monospace">
        {String(value)}
      </Text>
    );
  };

  const strategyHistory = useMemo(() => {
    const latest: Partial<
      Record<BackupStrategy, { backup: Backup; date: Date }>
    > = {};

    backups.forEach((backup) => {
      const strategy = resolveBackupStrategy(backup);
      const referenceTimestamp =
        backup.manifest?.changeWindow?.until ??
        backup.manifest?.timestamp ??
        backup.timestamp;
      const date = parseTimestamp(referenceTimestamp);
      if (!date) {
        return;
      }

      const existing = latest[strategy];
      if (!existing || date > existing.date) {
        latest[strategy] = { backup, date };
      }
    });

    return latest;
  }, [backups]);

  const nextDueLookup = useMemo(() => {
    const next: Partial<Record<BackupStrategy, Date | null>> = {};

    STRATEGY_SEQUENCE.forEach((key) => {
      const lastRun = strategyHistory[key]?.date ?? null;
      if (!lastRun) {
        next[key] = null;
        return;
      }

      const clone = new Date(lastRun.getTime());
      if (key === 'full') {
        clone.setDate(clone.getDate() + 7);
        next[key] = clone;
      } else if (key === 'differential') {
        clone.setDate(clone.getDate() + 1);
        next[key] = clone;
      } else {
        next[key] = null;
      }
    });

    return next;
  }, [strategyHistory]);

  const strategySchedule = useMemo(
    () =>
      STRATEGY_SEQUENCE.map((key) => ({
        key,
        meta: STRATEGY_META[key],
        last: strategyHistory[key]?.date ?? null,
        next: nextDueLookup[key] ?? null,
      })),
    [nextDueLookup, strategyHistory]
  );

  const renderBackupsCard = ({
    title = `Backups (${backups.length})`,
    subtitle,
  }: { title?: string; subtitle?: string } = {}) => (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={3}>{title}</Title>
          {subtitle ? (
            <Text size="sm" c="dimmed">
              {subtitle}
            </Text>
          ) : null}
        </div>
        <ActionIcon onClick={() => void fetchBackups()} loading={loading}>
          <IconRefresh size={18} />
        </ActionIcon>
      </Group>

      {loading ? (
        <Progress value={100} animated />
      ) : backups.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No backups found
        </Text>
      ) : (
        <ScrollArea h="55vh" scrollbarSize={10} offsetScrollbars>
          <MantineTable striped highlightOnHover>
            <MantineTable.Thead
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
                background: 'var(--mantine-color-white)',
              }}
            >
              <MantineTable.Tr>
                <MantineTable.Th>Date</MantineTable.Th>
                <MantineTable.Th>Files</MantineTable.Th>
                <MantineTable.Th>Size</MantineTable.Th>
                <MantineTable.Th>Actions</MantineTable.Th>
              </MantineTable.Tr>
            </MantineTable.Thead>
            <MantineTable.Tbody>
              {backups.map((backup) => (
                <MantineTable.Tr key={backup.timestamp}>
                  <MantineTable.Td>
                    <Text size="sm">{formatDate(backup.timestamp)}</Text>
                  </MantineTable.Td>
                  <MantineTable.Td>{backup.files.length}</MantineTable.Td>
                  <MantineTable.Td>
                    {formatFileSize(backup.totalSize)}
                  </MantineTable.Td>
                  <MantineTable.Td>
                    <Group gap="xs">
                      <ActionIcon
                        color="blue"
                        variant="subtle"
                        onClick={() => handlePreviewBackup(backup)}
                        title="Preview backup"
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                      <ActionIcon
                        color="green"
                        variant="subtle"
                        onClick={() => handleDownloadJSON(backup)}
                        title="Download JSON"
                      >
                        <IconDownload size={16} />
                      </ActionIcon>
                      <ActionIcon
                        color="teal"
                        variant="subtle"
                        onClick={() => handleDownloadSQL(backup)}
                        title="Download SQL"
                      >
                        <IconDatabase size={16} />
                      </ActionIcon>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() =>
                          void handleDeleteBackup(backup.timestamp)
                        }
                        title="Delete backup"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </MantineTable.Td>
                </MantineTable.Tr>
              ))}
            </MantineTable.Tbody>
          </MantineTable>
        </ScrollArea>
      )}
    </Card>
  );

  const renderTablesBrowser = (height = 'calc(83vh - 220px)') => {
    if (!previewData) {
      return (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow">
          Preview a backup to explore its tables.
        </Alert>
      );
    }

    const tableEntries = Object.entries(previewData.tables ?? {});
    if (!tableEntries.length) {
      return (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow">
          This backup did not include table data.
        </Alert>
      );
    }

    return (
      <Box
        style={{
          height,
          display: 'flex',
          gap: 'var(--mantine-spacing-md)',
        }}
      >
        <Box style={{ width: 240, height: '100%' }}>
          <ScrollArea
            style={{ height: '100%' }}
            offsetScrollbars
            scrollbarSize={6}
          >
            <Stack gap="xs">
              {tableEntries.map(([name, data]) => {
                const isActive = name === selectedTableName;

                return (
                  <Card
                    key={name}
                    withBorder
                    padding="sm"
                    radius="sm"
                    shadow={isActive ? 'sm' : 'xs'}
                    onClick={() => setSelectedTableName(name)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isActive ? '#edf2ff' : undefined,
                      borderColor: isActive ? '#4dabf7' : undefined,
                    }}
                  >
                    <Group justify="space-between" align="center">
                      <Text size="sm" fw={isActive ? 600 : 500} tt="capitalize">
                        {name}
                      </Text>
                      <Badge color={isActive ? 'blue' : 'gray'}>
                        {data.count} {data.count === 1 ? 'record' : 'records'}
                      </Badge>
                    </Group>
                  </Card>
                );
              })}
            </Stack>
          </ScrollArea>
        </Box>

        <Stack gap="md" style={{ flex: 1, minWidth: 0, height: '100%' }}>
          {selectedTableDetails ? (
            <>
              {selectedTableDetails.data.length ? (
                <Box style={{ flex: 1, minHeight: 0 }}>
                  <ScrollArea
                    style={{ height: '100%' }}
                    offsetScrollbars
                    scrollbarSize={8}
                  >
                    <div
                      style={{
                        minWidth: Math.max(
                          selectedTableDetails.columns.length * 160,
                          400
                        ),
                      }}
                    >
                      <MantineTable striped highlightOnHover stickyHeader>
                        <MantineTable.Thead>
                          <MantineTable.Tr>
                            {selectedTableDetails.columns.map((column) => (
                              <MantineTable.Th
                                key={`${selectedTableDetails.name}-${column}`}
                                style={{
                                  backgroundColor: 'var(--mantine-color-body)',
                                  position: 'sticky',
                                  top: 0,
                                  zIndex: 1,
                                }}
                              >
                                {column}
                              </MantineTable.Th>
                            ))}
                          </MantineTable.Tr>
                        </MantineTable.Thead>
                        <MantineTable.Tbody>
                          {selectedTableDetails.data.map((row) => {
                            const rowKey = createRowKey(
                              selectedTableDetails.name,
                              row
                            );

                            return (
                              <MantineTable.Tr key={rowKey}>
                                {selectedTableDetails.columns.map((column) => (
                                  <MantineTable.Td
                                    key={createCellKey(rowKey, column)}
                                  >
                                    <Text size="sm">
                                      {formatCellValue(row[column])}
                                    </Text>
                                  </MantineTable.Td>
                                ))}
                              </MantineTable.Tr>
                            );
                          })}
                        </MantineTable.Tbody>
                      </MantineTable>
                    </div>
                  </ScrollArea>
                </Box>
              ) : (
                <Alert icon={<IconAlertCircle size={16} />} color="gray">
                  <Text size="sm" c="dimmed">
                    No data available for this table.
                  </Text>
                </Alert>
              )}
            </>
          ) : (
            <Alert icon={<IconAlertCircle size={16} />} color="blue">
              <Text size="sm">
                Select a table from the list to view its full backup.
              </Text>
            </Alert>
          )}
        </Stack>
      </Box>
    );
  };

  return (
    <Stack gap="lg">
      <Tabs
        value={pageTab}
        onChange={(value) =>
          setPageTab((value as 'backup' | 'restore' | 'tables') ?? 'backup')
        }
        radius="md"
      >
        <Tabs.List>
          <Tabs.Tab value="backup">Backup</Tabs.Tab>
          <Tabs.Tab value="restore">Restore</Tabs.Tab>
          <Tabs.Tab value="tables" leftSection={<IconTable size={16} />}>
            Tables
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="backup" pt="md">
          <Stack gap="lg">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="md">
                <Title order={3}>Create Backup</Title>
                <Badge color="blue">Manual</Badge>
              </Group>

              <Stack gap="md">
                <Select
                  label="Backup strategy"
                  data={strategyOptions}
                  value={backupStrategy}
                  onChange={(value) =>
                    setBackupStrategy((value as BackupStrategy) ?? 'full')
                  }
                  description="Full weekly baseline, daily differential, or log stream"
                />
                <Select
                  label="Format"
                  data={[
                    { value: 'json', label: 'JSON only' },
                    { value: 'csv', label: 'CSV only' },
                    { value: 'xlsx', label: 'XLSX only' },
                    { value: 'sql', label: 'SQL dump only' },
                    {
                      value: 'all',
                      label: 'JSON + CSV + XLSX + SQL (recommended)',
                    },
                  ]}
                  value={isLogStrategy ? 'json' : backupFormat}
                  onChange={(v) =>
                    !isLogStrategy && setBackupFormat(v || 'all')
                  }
                  disabled={isLogStrategy}
                />
                {isLogStrategy ? (
                  <Alert icon={<IconHistory size={16} />} color="blue">
                    <Text size="sm">
                      Log captures always export JSON change events so you can
                      replay them during restore.
                    </Text>
                  </Alert>
                ) : null}

                <Switch
                  label="Include deleted records"
                  checked={includeSoftDeleted}
                  onChange={(e) =>
                    setIncludeSoftDeleted(e.currentTarget.checked)
                  }
                />

                <Button
                  leftSection={<IconDatabase size={16} />}
                  onClick={() => void handleCreateBackup()}
                  loading={creating}
                  fullWidth
                >
                  {creating ? 'Creating...' : 'Create Backup Now'}
                </Button>
              </Stack>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="md" align="flex-start">
                <div>
                  <Title order={3}>Strategy Schedule</Title>
                  <Text size="sm" c="dimmed">
                    Weekly full baseline, daily differential snapshots, and
                    continuous log capture.
                  </Text>
                </div>
                <Badge color="teal">Planner</Badge>
              </Group>

              <Stack gap="sm">
                {strategySchedule.map(({ key, meta, last, next }) => (
                  <Card key={key} withBorder padding="sm" radius="md">
                    <Group
                      justify="space-between"
                      align="center"
                      gap="md"
                      wrap="wrap"
                    >
                      <Group gap="sm" align="center">
                        <Badge color={meta.color}>{meta.label}</Badge>
                        <Text size="sm" c="dimmed">
                          {meta.cadence}
                        </Text>
                      </Group>
                      <Group gap="lg" align="center" wrap="wrap">
                        <div>
                          <Text size="xs" fw={600} c="dimmed">
                            Last run
                          </Text>
                          <Text size="sm">
                            {last
                              ? `${formatDate(last.toISOString())} (${formatRelativeTime(last)})`
                              : 'Never'}
                          </Text>
                        </div>
                        <div>
                          <Text size="xs" fw={600} c="dimmed">
                            Next due
                          </Text>
                          <Text size="sm">
                            {key === 'log'
                              ? 'Streaming'
                              : next
                                ? formatDate(next.toISOString())
                                : 'Ready now'}
                          </Text>
                        </div>
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconHistory size={14} />}
                          onClick={() =>
                            void handleCreateBackup({ strategy: key })
                          }
                          loading={creating}
                        >
                          Run {meta.label}
                        </Button>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="md">
                <Title order={3}>Auto-Backup</Title>
                <Badge color={autoBackupEnabled ? 'green' : 'gray'}>
                  {autoBackupEnabled ? 'ON' : 'OFF'}
                </Badge>
              </Group>

              <Stack gap="md">
                <Switch
                  label="Enable automatic backups"
                  checked={autoBackupEnabled}
                  onChange={(e) =>
                    setAutoBackupEnabled(e.currentTarget.checked)
                  }
                />

                {autoBackupEnabled && (
                  <>
                    <NumberInput
                      label="Interval (minutes)"
                      value={autoBackupInterval}
                      onChange={(v) => setAutoBackupInterval(Number(v) || 30)}
                      min={5}
                      max={1440}
                    />

                    <Alert icon={<IconClock size={16} />} color="green">
                      Backups every {autoBackupInterval} minutes while page is
                      open
                    </Alert>
                  </>
                )}
              </Stack>
            </Card>

            <Divider />

            {renderBackupsCard()}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="restore" pt="md">
          <Stack gap="lg">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="sm">
                <Title order={3}>Restore Workflow</Title>
                <Badge color="indigo">Step-by-step</Badge>
              </Group>
              <Text size="sm" c="dimmed" mb="sm">
                Use the steps below to bring data back safely. Restore controls
                live in the backup preview dialog.
              </Text>
              <Stack gap={6}>
                <Text size="sm">1. Preview a backup from the list.</Text>
                <Text size="sm">
                  2. Select the tables you want to restore and review the change
                  summary.
                </Text>
                <Text size="sm">
                  3. Confirm the restore and monitor the results summary.
                </Text>
              </Stack>
            </Card>

            {renderBackupsCard({
              title: `Available Backups (${backups.length})`,
              subtitle: 'Preview a backup to open the Restore controls.',
            })}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="tables" pt="md">
          <Stack gap="lg">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Title order={3}>Tables Explorer</Title>
                  <Text size="sm" c="dimmed">
                    {selectedBackup && previewData
                      ? `Viewing ${formatDate(selectedBackup.timestamp)}`
                      : 'Select a backup below and click Preview to load its tables.'}
                  </Text>
                </div>
                <Badge color={previewData ? 'indigo' : 'gray'}>
                  {previewData ? 'Preview loaded' : 'Waiting for preview'}
                </Badge>
              </Group>

              <Group gap="sm" mt="md" wrap="wrap">
                <Button
                  leftSection={<IconFileTypeCsv size={16} />}
                  variant="light"
                  color="green"
                  onClick={() => void handleDownloadAllCSV()}
                  disabled={!previewData}
                >
                  Download all CSV
                </Button>
                <Button
                  leftSection={<IconFileSpreadsheet size={16} />}
                  variant="light"
                  color="teal"
                  onClick={() => void handleDownloadAllXLSX()}
                  disabled={!previewData}
                >
                  Download all XLSX
                </Button>
                <Button
                  leftSection={<IconEye size={16} />}
                  variant="outline"
                  onClick={() => previewData && setPreviewModalOpen(true)}
                  disabled={!previewData}
                >
                  Open preview modal
                </Button>
              </Group>
            </Card>

            {previewLoading ? (
              <Progress value={100} animated />
            ) : previewData ? (
              renderTablesBrowser('65vh')
            ) : (
              <Alert icon={<IconAlertCircle size={16} />} color="yellow">
                Preview any backup from the list below to see its tables here.
              </Alert>
            )}

            {renderBackupsCard({
              title: `Available Backups (${backups.length})`,
              subtitle: 'Use Preview to load tables into the explorer.',
            })}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title="Backup Preview"
        size="90vw"
        styles={{
          content: {
            maxWidth: '90vw',
            width: '90vw',
            maxHeight: '80vh',
            height: '80vh',
          },
        }}
      >
        {previewLoading ? (
          <Progress value={100} animated />
        ) : previewData?.metadata && previewData?.tables ? (
          <Tabs defaultValue="summary">
            <Tabs.List>
              <Tabs.Tab
                value="summary"
                leftSection={<IconFileText size={16} />}
              >
                Summary
              </Tabs.Tab>
              <Tabs.Tab value="tables" leftSection={<IconDatabase size={16} />}>
                Tables
              </Tabs.Tab>
              <Tabs.Tab
                value="download"
                leftSection={<IconDownload size={16} />}
              >
                Download
              </Tabs.Tab>
              <Tabs.Tab value="restore" leftSection={<IconHistory size={16} />}>
                Restore
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="summary" pt="md">
              <Stack gap="md">
                <Alert icon={<IconCheck size={16} />} color="blue">
                  <Stack gap="xs">
                    <Text size="sm">
                      Created:{' '}
                      {new Date(previewData.metadata.createdAt).toLocaleString(
                        'en-US',
                        {
                          year: 'numeric',
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'UTC',
                        }
                      )}
                    </Text>
                    <Text size="sm">
                      Database: {previewData.metadata.database}
                    </Text>
                  </Stack>
                </Alert>

                <Card withBorder>
                  <Title order={5} mb="sm">
                    Tables
                  </Title>
                  <Stack gap="xs">
                    {Object.entries(previewData.tables).map(([name, data]) => (
                      <Group key={name} justify="space-between">
                        <Text size="sm">{name}</Text>
                        <Badge>{data.count} records</Badge>
                      </Group>
                    ))}
                  </Stack>
                </Card>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="tables" pt="md">
              {renderTablesBrowser()}
            </Tabs.Panel>

            <Tabs.Panel value="download" pt="md">
              <Stack gap="md">
                <Button
                  leftSection={<IconFile size={16} />}
                  onClick={() =>
                    selectedBackup && handleDownloadJSON(selectedBackup)
                  }
                >
                  Download JSON
                </Button>
                <Button
                  color="teal"
                  leftSection={<IconDatabase size={16} />}
                  onClick={() =>
                    selectedBackup && handleDownloadSQL(selectedBackup)
                  }
                >
                  Download SQL Dump
                </Button>
                <Button
                  color="green"
                  leftSection={<IconFileTypeCsv size={16} />}
                  onClick={() => void handleDownloadAllCSV()}
                >
                  Download All CSV
                </Button>
                <Button
                  color="cyan"
                  leftSection={<IconFileSpreadsheet size={16} />}
                  onClick={() => void handleDownloadAllXLSX()}
                >
                  Download All XLSX
                </Button>
                <Divider />
                <Stack gap="xs">
                  {Object.entries(previewData.tables).map(([name, data]) => (
                    <Group key={name} justify="space-between">
                      <Text size="sm">{name}</Text>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="subtle"
                          color="green"
                          disabled={!data.count}
                          onClick={() => handleDownloadCSV(name)}
                        >
                          CSV
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="cyan"
                          disabled={!data.count}
                          onClick={() => handleDownloadXLSX(name)}
                        >
                          XLSX
                        </Button>
                      </Group>
                    </Group>
                  ))}
                </Stack>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel
              value="restore"
              pt="md"
              style={{
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(85vh - 80px)',
              }}
            >
              <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  color="yellow"
                  title="Caution"
                >
                  Restoring data will insert records from this backup. Select
                  the specific tables you want to bring back—anything unchecked
                  stays as-is.
                </Alert>

                <Box style={{ flex: 1, minHeight: 0 }}>
                  <ScrollArea style={{ height: '100%' }} offsetScrollbars>
                    <Stack gap="md">
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <Text size="sm" fw={600}>
                            Tables in backup ({availableTables.length})
                          </Text>
                          <Group gap="xs">
                            <Button
                              size="xs"
                              variant="light"
                              onClick={handleSelectAllTables}
                            >
                              Select all
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              color="gray"
                              onClick={handleClearSelectedTables}
                            >
                              Clear
                            </Button>
                          </Group>
                        </Group>

                        <Stack gap="sm">
                          {availableTables.map((table) => {
                            const count = previewData.tables[table]?.count ?? 0;
                            const checked = restoreSelection.includes(table);
                            return (
                              <Box
                                key={table}
                                p="sm"
                                style={{
                                  borderRadius: 12,
                                  border: `1px solid ${
                                    checked
                                      ? 'var(--mantine-color-blue-5)'
                                      : 'var(--mantine-color-gray-3)'
                                  }`,
                                  backgroundColor: checked
                                    ? 'var(--mantine-color-blue-0)'
                                    : 'var(--mantine-color-white)',
                                  transition:
                                    'border-color 120ms ease, background-color 120ms ease',
                                }}
                              >
                                <Checkbox
                                  size="lg"
                                  checked={checked}
                                  onChange={(event) =>
                                    toggleTableSelection(
                                      table,
                                      event.currentTarget.checked
                                    )
                                  }
                                  styles={{
                                    body: { alignItems: 'flex-start' },
                                    label: { width: '100%' },
                                    inner: { marginTop: 4, marginRight: 14 },
                                  }}
                                  label={
                                    <Group justify="space-between" gap="sm">
                                      <Text fw={600} size="lg" tt="capitalize">
                                        {table}
                                      </Text>
                                      <Text size="sm" c="dimmed">
                                        {count} {count === 1 ? 'row' : 'rows'}
                                      </Text>
                                    </Group>
                                  }
                                />
                              </Box>
                            );
                          })}
                        </Stack>
                      </Stack>

                      {restoreSummaryEntries.length > 0 && (
                        <Card withBorder padding="md" radius="md">
                          <Stack gap="sm">
                            <Group justify="space-between">
                              <Text fw={600}>Last restore summary</Text>
                              <Badge color="green">Completed</Badge>
                            </Group>
                            <MantineTable striped highlightOnHover>
                              <MantineTable.Thead>
                                <MantineTable.Tr>
                                  <MantineTable.Th>Table</MantineTable.Th>
                                  <MantineTable.Th>Inserted</MantineTable.Th>
                                  <MantineTable.Th>Updated</MantineTable.Th>
                                  <MantineTable.Th>Attempted</MantineTable.Th>
                                  <MantineTable.Th>Skipped</MantineTable.Th>
                                  <MantineTable.Th>
                                    Before → After
                                  </MantineTable.Th>
                                  <MantineTable.Th>Notes</MantineTable.Th>
                                </MantineTable.Tr>
                              </MantineTable.Thead>
                              <MantineTable.Tbody>
                                {restoreSummaryEntries.map(
                                  ([table, result]) => (
                                    <MantineTable.Tr key={table}>
                                      <MantineTable.Td>{table}</MantineTable.Td>
                                      <MantineTable.Td>
                                        {result.count}
                                      </MantineTable.Td>
                                      <MantineTable.Td>
                                        {result.updated ?? '—'}
                                      </MantineTable.Td>
                                      <MantineTable.Td>
                                        {result.attempted ?? '—'}
                                      </MantineTable.Td>
                                      <MantineTable.Td>
                                        {result.skipped ?? '—'}
                                      </MantineTable.Td>
                                      <MantineTable.Td>
                                        {result.beforeCount ?? '—'} →{' '}
                                        {result.afterCount ?? '—'}
                                      </MantineTable.Td>
                                      <MantineTable.Td>
                                        {result.error ? (
                                          <Text c="red" size="sm">
                                            {result.error}
                                          </Text>
                                        ) : (
                                          <Text c="green" size="sm">
                                            OK
                                          </Text>
                                        )}
                                      </MantineTable.Td>
                                    </MantineTable.Tr>
                                  )
                                )}
                              </MantineTable.Tbody>
                            </MantineTable>
                          </Stack>
                        </Card>
                      )}
                    </Stack>
                  </ScrollArea>
                </Box>

                <Switch
                  label="Force overwrite existing data"
                  description="Deletes existing records in the selected tables before restoring."
                  checked={forceOverwrite}
                  onChange={(event) =>
                    setForceOverwrite(event.currentTarget.checked)
                  }
                />
              </Stack>

              <Group justify="flex-end" mt="md">
                <Button
                  leftSection={<IconHistory size={16} />}
                  loading={restoreLoading}
                  disabled={restoreDisabled}
                  onClick={() => void handleRestore()}
                >
                  {restoreLoading ? 'Restoring…' : 'Restore Backup'}
                </Button>
              </Group>
            </Tabs.Panel>
          </Tabs>
        ) : (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            <Text size="sm">
              Failed to load backup data. The file may be corrupted.
            </Text>
          </Alert>
        )}
      </Modal>

      <Modal
        opened={restorePreviewModalOpen}
        onClose={handleCloseRestorePreviewModal}
        title="Review rows before restoring"
        size="xl"
        radius="md"
        trapFocus={false}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Use the cascading selectors below to inspect the exact rows and
            columns that will be restored before continuing to the confirmation
            dialog.
          </Text>

          <Select
            label="1. Table"
            placeholder="Select a table"
            data={restorePreviewTableOptions}
            value={restorePreviewSelectedTable}
            onChange={(value) => setRestorePreviewSelectedTable(value)}
            searchable
          />

          <Group align="flex-end" gap="md">
            <Select
              flex={1}
              label="2. Change type"
              placeholder="Select change type"
              data={restorePreviewChangeTypeOptions}
              value={restorePreviewChangeType}
              onChange={(value) =>
                setRestorePreviewChangeType(
                  (value as 'insert' | 'update') || 'insert'
                )
              }
              disabled={
                restorePreviewForceOverwrite ||
                restorePreviewChangeTypeOptions.length <= 1
              }
            />

            <Select
              flex={1}
              label="3. Row"
              placeholder={
                restorePreviewRowOptions.length
                  ? 'Select a row'
                  : 'No rows to preview'
              }
              data={restorePreviewRowOptions}
              value={restorePreviewSelectedRow}
              onChange={(value) => setRestorePreviewSelectedRow(value)}
              searchable
              disabled={!restorePreviewRowOptions.length}
            />
          </Group>

          {restorePreviewEntry && (
            <Stack gap="xs">
              <Group gap="xs">
                <Badge color="blue">
                  {restorePreviewEntry.inserts.length} new
                </Badge>
                {!restorePreviewForceOverwrite && (
                  <Badge color="orange">
                    {restorePreviewEntry.updates.length} updated
                  </Badge>
                )}
                <Badge color="gray">
                  {restorePreviewEntry.skipped ?? 0} skipped
                </Badge>
                <Badge color="teal">
                  {restorePreviewEntry.attempted ?? 0} attempted
                </Badge>
              </Group>
              {restorePreviewEntry.notice && (
                <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                  {restorePreviewEntry.notice}
                </Alert>
              )}
              {restorePreviewForceOverwrite &&
                !!restorePreviewEntry.deletedCount && (
                  <Alert color="red" icon={<IconAlertCircle size={16} />}>
                    {restorePreviewEntry.deletedCount}{' '}
                    {restorePreviewEntry.deletedCount === 1 ? 'row' : 'rows'}{' '}
                    will be deleted before reinserting this backup because force
                    overwrite is enabled.
                  </Alert>
                )}
            </Stack>
          )}

          <Card withBorder padding="md" radius="md">
            {restorePreviewSelectedRowData?.row ? (
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <div>
                    <Text fw={600}>
                      {restorePreviewSelectedRowData.type === 'insert'
                        ? 'New row preview'
                        : 'Updated row preview'}
                    </Text>
                    {restorePreviewSelectedRowData.type === 'update' &&
                      (restorePreviewSelectedRowData.row?.id ||
                        restorePreviewSelectedRowData.row?.incoming) && (
                        <Text size="sm" c="dimmed">
                          {guessRowLabel(
                            restorePreviewSelectedRowData.row?.incoming ?? {},
                            'Selected row'
                          )}
                        </Text>
                      )}
                  </div>
                  {restorePreviewSelectedRowData.type === 'update' &&
                    restorePreviewSelectedRowData.row?.id !== null &&
                    restorePreviewSelectedRowData.row?.id !== undefined && (
                      <Badge color="gray">
                        ID {String(restorePreviewSelectedRowData.row.id)}
                      </Badge>
                    )}
                </Group>

                <ScrollArea h={320} offsetScrollbars scrollbarSize={6}>
                  {restorePreviewSelectedRowData.type === 'insert' ? (
                    <MantineTable striped highlightOnHover>
                      <MantineTable.Thead>
                        <MantineTable.Tr>
                          <MantineTable.Th>Column</MantineTable.Th>
                          <MantineTable.Th>Value</MantineTable.Th>
                        </MantineTable.Tr>
                      </MantineTable.Thead>
                      <MantineTable.Tbody>
                        {Object.entries(
                          restorePreviewSelectedRowData.row ?? {}
                        ).map(([column, value]) => (
                          <MantineTable.Tr key={column}>
                            <MantineTable.Td>
                              <Text size="sm" fw={600}>
                                {column}
                              </Text>
                            </MantineTable.Td>
                            <MantineTable.Td>
                              {renderPreviewValue(value)}
                            </MantineTable.Td>
                          </MantineTable.Tr>
                        ))}
                      </MantineTable.Tbody>
                    </MantineTable>
                  ) : (
                    <MantineTable striped highlightOnHover>
                      <MantineTable.Thead>
                        <MantineTable.Tr>
                          <MantineTable.Th>Column</MantineTable.Th>
                          <MantineTable.Th>Before</MantineTable.Th>
                          <MantineTable.Th>After</MantineTable.Th>
                        </MantineTable.Tr>
                      </MantineTable.Thead>
                      <MantineTable.Tbody>
                        {Object.entries(
                          restorePreviewSelectedRowData.row?.changes ?? {}
                        ).map(([column, diff]) => (
                          <MantineTable.Tr key={column}>
                            <MantineTable.Td>
                              <Text size="sm" fw={600}>
                                {column}
                              </Text>
                            </MantineTable.Td>
                            <MantineTable.Td>
                              {renderPreviewValue(diff.before)}
                            </MantineTable.Td>
                            <MantineTable.Td>
                              {renderPreviewValue(diff.after)}
                            </MantineTable.Td>
                          </MantineTable.Tr>
                        ))}
                      </MantineTable.Tbody>
                    </MantineTable>
                  )}
                </ScrollArea>
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                Select a table, change type, and row to preview what will be
                restored.
              </Text>
            )}
          </Card>

          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Only the rows listed above will be changed. Unchecked tables
              remain untouched.
            </Text>
            <Group>
              <Button
                variant="default"
                onClick={handleCloseRestorePreviewModal}
                disabled={restoreLoading}
              >
                Cancel
              </Button>
              <Button
                leftSection={<IconHistory size={16} />}
                onClick={() => void handleConfirmRestore()}
                loading={restoreLoading}
              >
                Continue to confirmation
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
