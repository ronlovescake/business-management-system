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
  NumberInput,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { getSwal } from '@/lib/alerts';
import { api } from '@/lib/api/client';
import { usePathname } from 'next/navigation';
import {
  IconDatabase,
  IconClock,
  IconFileTypeCsv,
  IconAlertCircle,
  IconFileSpreadsheet,
  IconFileText,
  IconHistory,
  IconTable,
  IconDownload,
} from '@tabler/icons-react';
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
  hasTableChanges,
  previewHasChanges,
} from '../backup/types';
import { useBackupSchedule } from '../backup/hooks/useBackupSchedule';
import { BackupListCard } from './backup-restore/BackupListCard';
import { BackupTablesBrowser } from './backup-restore/BackupTablesBrowser';
import { BackupPreviewModal } from './backup-restore/BackupPreviewModal';
import { RestorePreviewModal } from './backup-restore/RestorePreviewModal';
import { useBackupRestoreSidebarStore } from './backup-restore/backupRestoreSidebarStore';
import { StandardTableControls } from '@/components/tables/StandardDataTable';
import { useBackupDownloadHandlers } from './backup-restore/useBackupDownloadHandlers';
import {
  ControlPanelCard,
  type ControlPanelTabConfig,
} from '@/components/ui/ControlPanelCard';
import {
  areBackupSidebarTablesEqual,
  getRestorePreviewChangeTypeOptions,
  getRestorePreviewRowOptions,
  getRestorePreviewSelectedRowData,
  getRestorePreviewTableOptions,
  getSelectedTableDetails,
} from './backup-restore/backupRestoreTabUtils';

export function BackupRestoreTab() {
  const pathname = usePathname();
  const isAdminBackupRestore = pathname?.startsWith('/admin/backup-restore');

  const {
    tables: sidebarTables,
    selectedTable: sidebarSelectedTable,
    setTables: setSidebarTables,
    setSelectedTable: setSidebarSelectedTable,
    clear: clearSidebar,
  } = useBackupRestoreSidebarStore();

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
  const [tableSearchQuery, setTableSearchQuery] = useState('');
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

  const TABLE_SAMPLE_LIMIT = 250;
  const PREVIEW_SUMMARY_TIMEOUT_MS = 120000;
  const PREVIEW_TABLE_TIMEOUT_MS = 180000;

  const fetchWithTimeout = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 30000) => {
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
    },
    []
  );

  const fetchTableSample = useCallback(
    async (
      timestamp: string,
      jsonFile: string,
      table: string,
      {
        limit = TABLE_SAMPLE_LIMIT,
        offset = 0,
      }: { limit?: number; offset?: number } = {}
    ) => {
      const response = await fetchWithTimeout(
        `/api/backup/${encodeURIComponent(timestamp)}/${encodeURIComponent(jsonFile)}?mode=table&table=${encodeURIComponent(table)}&limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`,
        undefined,
        PREVIEW_TABLE_TIMEOUT_MS
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch table sample: ${response.statusText}`);
      }

      const payload = (await response.json()) as BackupData;

      setPreviewData((prev) => {
        if (!prev) {
          return payload;
        }
        return {
          ...prev,
          metadata: prev.metadata ?? payload.metadata,
          tables: {
            ...prev.tables,
            ...(payload.tables || {}),
          },
        };
      });

      return payload;
    },
    [PREVIEW_TABLE_TIMEOUT_MS, TABLE_SAMPLE_LIMIT, fetchWithTimeout]
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
  const backupDateOptions = useMemo(
    () =>
      [...backups]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .map((backup) => ({
          value: backup.timestamp,
          label: formatBackupTimestamp(backup.timestamp),
        })),
    [backups]
  );

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
    const Swal = await getSwal();
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

  const handlePreviewBackup = useCallback(
    async (backup: Backup) => {
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

        // Fetch lightweight summary (counts only), then load a small sample for the first table.
        const response = await fetchWithTimeout(
          `/api/backup/${encodeURIComponent(backup.timestamp)}/${encodeURIComponent(jsonFile)}?mode=summary`,
          undefined,
          PREVIEW_SUMMARY_TIMEOUT_MS
        );
        if (!response.ok) {
          throw new Error(
            `Failed to fetch backup summary: ${response.statusText}`
          );
        }
        const summary: BackupData = await response.json();
        setPreviewData(summary);
        const [firstTable] = Object.keys(summary.tables);
        setSelectedTableName(firstTable ?? null);
        setRestoreSelection([]);
        setForceOverwrite(false);
        setPreviewJsonFile(jsonFile);

        if (firstTable) {
          void fetchTableSample(backup.timestamp, jsonFile, firstTable).catch(
            (sampleError) => {
              showNotification({
                title: 'Preview Table Load Delayed',
                message:
                  sampleError instanceof Error
                    ? sampleError.message
                    : 'Could not pre-load the first table sample.',
                color: 'yellow',
              });
            }
          );
        }
      } catch (error) {
        const isTimeoutError =
          error instanceof DOMException &&
          (error.name === 'AbortError' || error.name === 'TimeoutError');
        showNotification({
          title: 'Preview Failed',
          message: isTimeoutError
            ? 'Preview timed out on a large backup. Please retry or open a specific table.'
            : error instanceof Error
              ? error.message
              : 'Unknown error',
          color: 'red',
        });
        setPreviewModalOpen(false);
        setSelectedTableName(null);
        setPreviewJsonFile(null);
      } finally {
        setPreviewLoading(false);
      }
    },
    [PREVIEW_SUMMARY_TIMEOUT_MS, fetchTableSample, fetchWithTimeout, pageTab]
  );

  const handleBackupDateFilterChange = useCallback(
    (value: string | null) => {
      if (!value) {
        return;
      }
      const backup = backups.find((item) => item.timestamp === value);
      if (backup) {
        void handlePreviewBackup(backup);
      }
    },
    [backups, handlePreviewBackup]
  );

  const handleSelectPreviewTable = useCallback(
    async (table: string) => {
      const isSameTable = table === selectedTableName;
      if (!isSameTable) {
        setSelectedTableName(table);
      }

      if (!selectedBackup || !previewJsonFile) {
        return;
      }

      const alreadyLoaded = previewData?.tables?.[table]?.data;
      if (Array.isArray(alreadyLoaded) && alreadyLoaded.length > 0) {
        return;
      }

      try {
        setPreviewLoading(true);
        await fetchTableSample(
          selectedBackup.timestamp,
          previewJsonFile,
          table
        );
      } catch (error) {
        const isTimeoutError =
          error instanceof DOMException &&
          (error.name === 'AbortError' || error.name === 'TimeoutError');
        showNotification({
          title: 'Preview Failed',
          message: isTimeoutError
            ? 'Table preview timed out. Please retry with fewer rows or wait for load.'
            : error instanceof Error
              ? error.message
              : 'Unknown error',
          color: 'red',
        });
      } finally {
        setPreviewLoading(false);
      }
    },
    [
      selectedBackup,
      previewJsonFile,
      previewData,
      fetchTableSample,
      selectedTableName,
    ]
  );

  useEffect(() => {
    if (!isAdminBackupRestore) {
      return;
    }

    if (!previewData?.tables) {
      if (sidebarTables.length > 0) {
        setSidebarTables([]);
      }
      if (sidebarSelectedTable !== null) {
        setSidebarSelectedTable(null);
      }
      return;
    }

    const summaries = Object.entries(previewData.tables)
      .map(([name, table]) => ({ name, count: table.count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!areBackupSidebarTablesEqual(summaries, sidebarTables)) {
      setSidebarTables(summaries);
    }

    const validTableNames = summaries.map((t) => t.name);
    if (validTableNames.length === 0) {
      if (sidebarSelectedTable !== null) {
        setSidebarSelectedTable(null);
      }
      return;
    }

    if (
      !sidebarSelectedTable ||
      !validTableNames.includes(sidebarSelectedTable)
    ) {
      const preferred =
        selectedTableName && validTableNames.includes(selectedTableName)
          ? selectedTableName
          : validTableNames[0];

      if (preferred !== sidebarSelectedTable) {
        setSidebarSelectedTable(preferred);
      }
    }
  }, [
    isAdminBackupRestore,
    previewData,
    selectedTableName,
    sidebarSelectedTable,
    sidebarTables,
    setSidebarSelectedTable,
    setSidebarTables,
  ]);

  useEffect(() => {
    if (!isAdminBackupRestore) {
      return;
    }

    if (!sidebarSelectedTable) {
      return;
    }

    const hasLoadedTableData = Boolean(
      previewData?.tables?.[sidebarSelectedTable]?.data
    );

    if (sidebarSelectedTable === selectedTableName && hasLoadedTableData) {
      return;
    }

    void handleSelectPreviewTable(sidebarSelectedTable);
  }, [
    isAdminBackupRestore,
    sidebarSelectedTable,
    selectedTableName,
    previewData,
    handleSelectPreviewTable,
  ]);

  useEffect(() => {
    if (!isAdminBackupRestore) {
      return;
    }
    return () => {
      clearSidebar();
    };
  }, [isAdminBackupRestore, clearSidebar]);

  const {
    handleDownloadJSON,
    handleDownloadSQL,
    handleDownloadXLSX,
    handleDownloadAllXLSX,
    handleDownloadCSV,
    handleDownloadAllCSV,
  } = useBackupDownloadHandlers({
    previewData,
    selectedBackupTimestamp: selectedBackup?.timestamp ?? null,
    previewJsonFile,
    fetchTableSample,
  });

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
        const insertCount = entry.insertCount ?? entry.inserts.length;
        const updateCount = entry.updateCount ?? entry.updates.length;
        const defaultChangeType =
          insertCount > 0
            ? 'insert'
            : !forceOverwrite && updateCount > 0
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
    const Swal = await getSwal();
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

    const hasInserts = (entry.insertCount ?? entry.inserts.length) > 0;
    const hasUpdates =
      !restorePreviewForceOverwrite &&
      (entry.updateCount ?? entry.updates.length) > 0;

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

  const activeTableName =
    isAdminBackupRestore && sidebarSelectedTable
      ? sidebarSelectedTable
      : selectedTableName;

  const selectedTableDetails = useMemo(() => {
    return getSelectedTableDetails(previewData, activeTableName);
  }, [previewData, activeTableName]);

  const restorePreviewEntry = useMemo(() => {
    if (!restorePreviewSelectedTable || !restorePreviewData) {
      return null;
    }
    return restorePreviewData[restorePreviewSelectedTable] ?? null;
  }, [restorePreviewSelectedTable, restorePreviewData]);

  const restorePreviewTableOptions = useMemo(() => {
    return getRestorePreviewTableOptions(
      restorePreviewData,
      restorePreviewTables,
      restorePreviewForceOverwrite
    );
  }, [restorePreviewData, restorePreviewTables, restorePreviewForceOverwrite]);

  const restorePreviewChangeTypeOptions = useMemo(() => {
    return getRestorePreviewChangeTypeOptions(
      restorePreviewEntry,
      restorePreviewForceOverwrite
    );
  }, [restorePreviewEntry, restorePreviewForceOverwrite]);

  const restorePreviewRowOptions = useMemo(() => {
    return getRestorePreviewRowOptions(
      restorePreviewEntry,
      restorePreviewChangeType,
      restorePreviewForceOverwrite
    );
  }, [
    restorePreviewEntry,
    restorePreviewChangeType,
    restorePreviewForceOverwrite,
  ]);

  const restorePreviewSelectedRowData = useMemo(() => {
    return getRestorePreviewSelectedRowData(
      restorePreviewEntry,
      restorePreviewSelectedRow,
      restorePreviewChangeType,
      restorePreviewForceOverwrite
    );
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

  const controlTabs: ControlPanelTabConfig[] = [
    {
      value: 'backup',
      label: 'Backup',
      leftSection: <IconDatabase size={16} />,
    },
    {
      value: 'restore',
      label: 'Restore',
      leftSection: <IconHistory size={16} />,
    },
    {
      value: 'tables',
      label: 'Tables',
      leftSection: <IconTable size={16} />,
      panel: (
        <Group gap="sm" align="center" wrap="wrap">
          <div style={{ flex: 1, minWidth: 240 }}>
            <StandardTableControls
              searchPlaceholder="Search rows..."
              onSearch={setTableSearchQuery}
              searchValue={tableSearchQuery}
              hideImport
              hideExport
              hideAddNew
              expandSearch
              searchAddon={
                <Select
                  placeholder="Backup date"
                  data={backupDateOptions}
                  value={selectedBackup?.timestamp ?? null}
                  onChange={handleBackupDateFilterChange}
                  clearable
                  style={{ minWidth: 220 }}
                />
              }
            />
          </div>

          <Group gap="xs" wrap="wrap">
            <Button
              leftSection={<IconFileTypeCsv size={16} />}
              onClick={() =>
                selectedTableName
                  ? void handleDownloadCSV(selectedTableName)
                  : undefined
              }
              disabled={!selectedTableName || !previewData}
            >
              Download CSV
            </Button>
            <Button
              leftSection={<IconFileSpreadsheet size={16} />}
              onClick={() =>
                selectedTableName
                  ? void handleDownloadXLSX(selectedTableName)
                  : undefined
              }
              disabled={!selectedTableName || !previewData}
            >
              Download XLSX
            </Button>
            <Button
              leftSection={<IconDatabase size={16} />}
              onClick={() =>
                selectedBackup
                  ? void handleDownloadJSON(selectedBackup)
                  : undefined
              }
              disabled={!selectedBackup}
            >
              Download JSON
            </Button>
            <Button
              leftSection={<IconFileText size={16} />}
              onClick={() =>
                selectedBackup
                  ? void handleDownloadSQL(selectedBackup)
                  : undefined
              }
              disabled={!selectedBackup}
            >
              Download SQL
            </Button>
            <Button
              leftSection={<IconDownload size={16} />}
              color="green"
              onClick={() => {
                if (!selectedBackup || !previewData) {
                  return;
                }
                void handleDownloadAllCSV();
                void handleDownloadAllXLSX();
                void handleDownloadJSON(selectedBackup);
                void handleDownloadSQL(selectedBackup);
              }}
              disabled={!selectedBackup || !previewData}
            >
              Download All
            </Button>
          </Group>
        </Group>
      ),
    },
  ];

  return (
    <Stack gap="lg">
      <ControlPanelCard
        title="Backup Records"
        tabs={controlTabs}
        activeTab={pageTab}
        onTabChange={(value) =>
          setPageTab((value as 'backup' | 'restore' | 'tables') ?? 'backup')
        }
      />

      {pageTab === 'backup' && (
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
                onChange={(v) => !isLogStrategy && setBackupFormat(v || 'all')}
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
                onChange={(e) => setIncludeSoftDeleted(e.currentTarget.checked)}
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
                onChange={(e) => setAutoBackupEnabled(e.currentTarget.checked)}
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
      )}

      {pageTab === 'restore' && (
        <Stack gap="lg">
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
      )}

      {pageTab === 'tables' && (
        <Stack gap="lg">
          {previewLoading && !previewData ? (
            <Progress value={100} animated />
          ) : previewData ? (
            <BackupTablesBrowser
              previewData={previewData}
              selectedTableName={activeTableName}
              selectedTableDetails={selectedTableDetails}
              onSelectTable={handleSelectPreviewTable}
              searchQuery={tableSearchQuery}
              height="65vh"
              showTableList={!isAdminBackupRestore}
            />
          ) : (
            <Alert icon={<IconAlertCircle size={16} />} color="yellow">
              Preview any backup from the list below to see its tables here.
            </Alert>
          )}
        </Stack>
      )}

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
        onSelectTable={(table) => void handleSelectPreviewTable(table)}
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
