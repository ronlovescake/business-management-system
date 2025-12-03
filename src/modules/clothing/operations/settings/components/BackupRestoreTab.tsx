'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Stack,
  Group,
  Button,
  Card,
  Text,
  Title,
  Badge,
  Select,
  Switch,
  Alert,
  Progress,
  Divider,
  Tabs,
  NumberInput,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import Swal from 'sweetalert2';
import { api } from '@/lib/api/client';
import {
  IconDatabase,
  IconClock,
  IconFileTypeCsv,
  IconAlertCircle,
  IconEye,
  IconFileSpreadsheet,
  IconHistory,
  IconTable,
} from '@tabler/icons-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type {
  Backup,
  BackupData,
  BackupStrategy,
  RestorePreviewResults,
  RestoreResults,
} from '../backup/types';
import {
  STRATEGY_META,
  formatBackupTimestamp,
  formatRelativeTime,
  guessRowLabel,
  hasTableChanges,
  previewHasChanges,
} from '../backup/types';
import { useBackupSchedule } from '../backup/hooks/useBackupSchedule';
import { BackupListCard } from './backup-restore/BackupListCard';
import { BackupTablesBrowser } from './backup-restore/BackupTablesBrowser';
import { BackupPreviewModal } from './backup-restore/BackupPreviewModal';
import { RestorePreviewModal } from './backup-restore/RestorePreviewModal';

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

    const formattedDate = formatBackupTimestamp(timestamp);
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
    const formattedDate = formatBackupTimestamp(selectedBackup.timestamp);
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

  const { strategySchedule } = useBackupSchedule(backups);

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
                              ? `${formatBackupTimestamp(last.toISOString())} (${formatRelativeTime(last)})`
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
                                ? formatBackupTimestamp(next.toISOString())
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

            <BackupListCard
              backups={backups}
              loading={loading}
              onRefresh={() => void fetchBackups()}
              onPreview={handlePreviewBackup}
              onDownloadJSON={handleDownloadJSON}
              onDownloadSQL={handleDownloadSQL}
              onDelete={(backup) => void handleDeleteBackup(backup.timestamp)}
            />
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

            <BackupListCard
              backups={backups}
              loading={loading}
              title={`Available Backups (${backups.length})`}
              subtitle="Preview a backup to open the Restore controls."
              onRefresh={() => void fetchBackups()}
              onPreview={handlePreviewBackup}
              onDownloadJSON={handleDownloadJSON}
              onDownloadSQL={handleDownloadSQL}
              onDelete={(backup) => void handleDeleteBackup(backup.timestamp)}
            />
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
                      ? `Viewing ${formatBackupTimestamp(selectedBackup.timestamp)}`
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
              <BackupTablesBrowser
                previewData={previewData}
                selectedTableName={selectedTableName}
                selectedTableDetails={selectedTableDetails}
                onSelectTable={setSelectedTableName}
                height="65vh"
              />
            ) : (
              <Alert icon={<IconAlertCircle size={16} />} color="yellow">
                Preview any backup from the list below to see its tables here.
              </Alert>
            )}

            <BackupListCard
              backups={backups}
              loading={loading}
              title={`Available Backups (${backups.length})`}
              subtitle="Use Preview to load tables into the explorer."
              onRefresh={() => void fetchBackups()}
              onPreview={handlePreviewBackup}
              onDownloadJSON={handleDownloadJSON}
              onDownloadSQL={handleDownloadSQL}
              onDelete={(backup) => void handleDeleteBackup(backup.timestamp)}
            />
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <BackupPreviewModal
        opened={previewModalOpen}
        loading={previewLoading}
        previewData={previewData}
        selectedTableName={selectedTableName}
        selectedTableDetails={selectedTableDetails}
        availableTables={availableTables}
        restoreSelection={restoreSelection}
        restoreSummaryEntries={restoreSummaryEntries}
        forceOverwrite={forceOverwrite}
        restoreLoading={restoreLoading}
        restoreDisabled={restoreDisabled}
        canDownloadBackup={Boolean(selectedBackup)}
        onClose={() => setPreviewModalOpen(false)}
        onSelectTable={(table) => setSelectedTableName(table)}
        onSelectAllTables={handleSelectAllTables}
        onClearSelectedTables={handleClearSelectedTables}
        onToggleTable={toggleTableSelection}
        onSetForceOverwrite={setForceOverwrite}
        onDownloadJSON={() =>
          selectedBackup ? void handleDownloadJSON(selectedBackup) : undefined
        }
        onDownloadSQL={() =>
          selectedBackup ? void handleDownloadSQL(selectedBackup) : undefined
        }
        onDownloadAllCSV={() => void handleDownloadAllCSV()}
        onDownloadAllXLSX={() => void handleDownloadAllXLSX()}
        onDownloadCSV={(table) => void handleDownloadCSV(table)}
        onDownloadXLSX={(table) => void handleDownloadXLSX(table)}
        onRestore={() => void handleRestore()}
      />

      <RestorePreviewModal
        opened={restorePreviewModalOpen}
        loading={restoreLoading}
        forceOverwrite={restorePreviewForceOverwrite}
        tableOptions={restorePreviewTableOptions}
        selectedTable={restorePreviewSelectedTable}
        onSelectTable={setRestorePreviewSelectedTable}
        changeTypeOptions={restorePreviewChangeTypeOptions}
        changeType={restorePreviewChangeType}
        onChangeType={(value) => setRestorePreviewChangeType(value ?? 'insert')}
        rowOptions={restorePreviewRowOptions}
        selectedRow={restorePreviewSelectedRow}
        onSelectRow={setRestorePreviewSelectedRow}
        entry={restorePreviewEntry}
        rowData={restorePreviewSelectedRowData}
        onClose={handleCloseRestorePreviewModal}
        onConfirm={() => void handleConfirmRestore()}
      />
    </Stack>
  );
}
