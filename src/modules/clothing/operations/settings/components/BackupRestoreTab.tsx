'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Stack } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { getSwal } from '@/lib/alerts';
import { api } from '@/lib/api/client';
import { usePathname } from 'next/navigation';
import { IconDatabase, IconHistory, IconTable } from '@tabler/icons-react';
import type {
  Backup,
  BackupData,
  BackupChangesComparison,
  BackupChangePreview,
  PitrStatus,
  RestoreJobStatus,
  RestorePlan,
  BackupStrategy,
} from '../backup/types';
import { STRATEGY_META, formatBackupTimestamp } from '../backup/types';
import { useBackupSchedule } from '../backup/hooks/useBackupSchedule';
import { BackupPreviewModal } from './backup-restore/BackupPreviewModal';
import { BackupChangeDetailModal } from './backup-restore/BackupChangeDetailModal';
import { useBackupRestoreSidebarStore } from './backup-restore/backupRestoreSidebarStore';
import { useBackupDownloadHandlers } from './backup-restore/useBackupDownloadHandlers';
import { BackupTablesActionPanel } from './backup-restore/BackupTablesActionPanel';
import { BackupSection } from './backup-restore/BackupSection';
import { PitrStatusCard } from './backup-restore/PitrStatusCard';
import { RestoreSection } from './backup-restore/RestoreSection';
import { TablePreviewSection } from './backup-restore/TablePreviewSection';
import {
  ControlPanelCard,
  type ControlPanelTabConfig,
} from '@/components/ui/ControlPanelCard';
import {
  areBackupSidebarTablesEqual,
  buildBackupTableSampleUrl,
  fetchWithTimeout,
  getBackupChangePreviewRowOptions,
  getBackupChangePreviewSelectedRowsData,
  getBackupChangePreviewSelectedRowData,
  getBackupChangePreviewTypeOptions,
  getSelectedTableDetails,
} from './backup-restore/backupRestoreTabUtils';

export function BackupRestoreTab() {
  const pathname = usePathname();
  const isAdminBackupRestore = Boolean(
    pathname?.startsWith('/admin/backup-restore')
  );

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
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<BackupData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [restorePlan, setRestorePlan] = useState<RestorePlan | null>(null);
  const [restorePlanLoading, setRestorePlanLoading] = useState(false);
  const [restorePlanError, setRestorePlanError] = useState<string | null>(null);
  const [backupChanges, setBackupChanges] =
    useState<BackupChangesComparison | null>(null);
  const [backupChangesLoading, setBackupChangesLoading] = useState(false);
  const [backupChangesError, setBackupChangesError] = useState<string | null>(
    null
  );
  const [summaryComparisonTable, setSummaryComparisonTable] = useState<
    string | null
  >(null);
  const [summaryComparisonLoading, setSummaryComparisonLoading] =
    useState(false);
  const [summaryComparison, setSummaryComparison] =
    useState<BackupChangePreview | null>(null);
  const [summaryComparisonError, setSummaryComparisonError] = useState<
    string | null
  >(null);
  const [summaryComparisonType, setSummaryComparisonType] = useState<
    'added' | 'updated' | 'removed'
  >('updated');
  const [summaryComparisonSelectedRows, setSummaryComparisonSelectedRows] =
    useState<string[]>([]);
  const [backupChangePreviewOpen, setBackupChangePreviewOpen] = useState(false);
  const [backupChangePreviewLoading, setBackupChangePreviewLoading] =
    useState(false);
  const [backupChangePreview, setBackupChangePreview] =
    useState<BackupChangePreview | null>(null);
  const [backupChangePreviewError, setBackupChangePreviewError] = useState<
    string | null
  >(null);
  const [backupChangePreviewTable, setBackupChangePreviewTable] = useState<
    string | null
  >(null);
  const [backupChangePreviewType, setBackupChangePreviewType] = useState<
    'added' | 'updated' | 'removed'
  >('added');
  const [backupChangePreviewSelectedRow, setBackupChangePreviewSelectedRow] =
    useState<string | null>(null);
  const [restoreRunnerAvailable, setRestoreRunnerAvailable] = useState(false);
  const [restoreRunnerHeartbeatAt, setRestoreRunnerHeartbeatAt] = useState<
    string | null
  >(null);
  const [pitrStatus, setPitrStatus] = useState<PitrStatus | null>(null);
  const [pitrStatusLoading, setPitrStatusLoading] = useState(false);
  const [pitrCreating, setPitrCreating] = useState(false);
  const [restoreJobStatus, setRestoreJobStatus] =
    useState<RestoreJobStatus | null>(null);
  const [restoreJobLoading, setRestoreJobLoading] = useState(false);
  const [restoreSubmitting, setRestoreSubmitting] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(
    null
  );
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [previewJsonFile, setPreviewJsonFile] = useState<string | null>(null);
  const [pageTab, setPageTab] = useState<'backup' | 'restore' | 'tables'>(
    'backup'
  );

  const TABLE_SAMPLE_LIMIT = 250;
  const PREVIEW_SUMMARY_TIMEOUT_MS = 120000;
  const PREVIEW_TABLE_TIMEOUT_MS = 180000;

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
        buildBackupTableSampleUrl(timestamp, jsonFile, table, limit, offset),
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
    [PREVIEW_TABLE_TIMEOUT_MS, TABLE_SAMPLE_LIMIT]
  );
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

  const fetchRestorePlan = useCallback(
    async (timestamp: string) => {
      const response = await fetchWithTimeout(
        `/api/backup/${encodeURIComponent(timestamp)}/plan`,
        undefined,
        PREVIEW_SUMMARY_TIMEOUT_MS
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch restore plan: ${response.statusText}`);
      }

      const payload = (await response.json()) as {
        success: boolean;
        plan?: RestorePlan;
        error?: string;
      };

      if (!payload.success || !payload.plan) {
        throw new Error(payload.error || 'Failed to fetch restore plan');
      }

      return payload.plan;
    },
    [PREVIEW_SUMMARY_TIMEOUT_MS]
  );

  const fetchBackupChanges = useCallback(
    async (timestamp: string) => {
      const response = await fetchWithTimeout(
        `/api/backup/${encodeURIComponent(timestamp)}/changes`,
        undefined,
        PREVIEW_SUMMARY_TIMEOUT_MS
      );

      const payload = (await response.json()) as {
        success: boolean;
        comparison?: BackupChangesComparison;
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.comparison) {
        throw new Error(payload.error || 'Failed to fetch backup changes');
      }

      return payload.comparison;
    },
    [PREVIEW_SUMMARY_TIMEOUT_MS]
  );

  const fetchBackupChangePreview = useCallback(
    async (timestamp: string, table: string) => {
      const response = await fetchWithTimeout(
        `/api/backup/${encodeURIComponent(timestamp)}/changes/${encodeURIComponent(table)}`,
        undefined,
        30000
      );

      const payload = (await response.json()) as {
        success: boolean;
        preview?: BackupChangePreview;
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.preview) {
        throw new Error(
          payload.error || 'Failed to load detailed change preview'
        );
      }

      return payload.preview;
    },
    []
  );

  const fetchRestoreRunnerStatus = useCallback(async () => {
    setRestoreJobLoading(true);

    try {
      const response = await fetchWithTimeout(
        '/api/restore/run',
        undefined,
        15000
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch restore status: ${response.statusText}`
        );
      }

      const payload = (await response.json()) as {
        success: boolean;
        runnerAvailable?: boolean;
        runnerHeartbeatAt?: string | null;
        status?: RestoreJobStatus | null;
        error?: string;
      };

      if (!payload.success) {
        throw new Error(payload.error || 'Failed to fetch restore status');
      }

      setRestoreRunnerAvailable(Boolean(payload.runnerAvailable));
      setRestoreRunnerHeartbeatAt(payload.runnerHeartbeatAt ?? null);
      setRestoreJobStatus(payload.status ?? null);
    } catch {
      if (!restoreJobStatus) {
        setRestoreRunnerAvailable(false);
        setRestoreRunnerHeartbeatAt(null);
      }
    } finally {
      setRestoreJobLoading(false);
    }
  }, [restoreJobStatus]);

  const fetchPitrStatus = useCallback(async () => {
    setPitrStatusLoading(true);

    try {
      const payload = await api.get<{
        success: boolean;
        status?: PitrStatus;
        error?: string;
      }>('/api/backup/pitr');

      if (!payload.success || !payload.status) {
        throw new Error(payload.error || 'Failed to fetch PITR status');
      }

      setPitrStatus(payload.status);
    } catch (error) {
      showNotification({
        title: 'PITR status unavailable',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setPitrStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBackups();
  }, [fetchBackups]);

  useEffect(() => {
    void fetchPitrStatus();
  }, [fetchPitrStatus]);

  useEffect(() => {
    void fetchRestoreRunnerStatus();
  }, [fetchRestoreRunnerStatus]);

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
          message?: string;
          warnings?: string[];
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
            title: data.warnings?.length
              ? isAuto
                ? `⚠️ ${strategyMeta.label} Auto-Backup Completed With Warnings`
                : `⚠️ ${strategyMeta.label} Backup Created With Warnings`
              : isAuto
                ? `✅ ${strategyMeta.label} Auto-Backup Complete`
                : `✅ ${strategyMeta.label} Backup Created`,
            message: data.warnings?.length
              ? `${strategyMeta.label} backup saved (${(data.backup.totalSize / 1024 / 1024).toFixed(2)} MB). ${data.warnings[0]}`
              : `${strategyMeta.label} backup saved (${(data.backup.totalSize / 1024 / 1024).toFixed(2)} MB)`,
            color: data.warnings?.length ? 'yellow' : 'green',
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

  const handleCreatePitrBaseBackup = useCallback(async () => {
    setPitrCreating(true);

    try {
      const payload = await api.post<{
        success: boolean;
        message?: string;
        error?: string;
        status?: PitrStatus;
      }>('/api/backup/pitr', {});

      if (!payload.success) {
        throw new Error(payload.error || 'Failed to create PITR base backup');
      }

      if (payload.status) {
        setPitrStatus(payload.status);
      } else {
        await fetchPitrStatus();
      }

      showNotification({
        title: 'PITR base backup created',
        message:
          payload.message ||
          'A new physical base backup is available for point-in-time recovery.',
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'PITR base backup failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setPitrCreating(false);
    }
  }, [fetchPitrStatus]);

  const handlePreviewBackup = useCallback(
    async (backup: Backup) => {
      setSelectedBackup(backup);
      const shouldOpenModal = pageTab !== 'tables';
      setPreviewModalOpen(shouldOpenModal);
      setPreviewLoading(true);
      setRestorePlanLoading(true);
      setRestorePlanError(null);
      setRestorePlan(null);
      setBackupChangesLoading(true);
      setBackupChangesError(null);
      setBackupChanges(null);
      setSummaryComparisonTable(null);
      setSummaryComparison(null);
      setSummaryComparisonError(null);
      setSummaryComparisonSelectedRows([]);
      setPreviewData(null);
      setSelectedTableName(null);
      setPreviewJsonFile(null);

      try {
        const jsonFile =
          backup.files.find(
            (f) => f.startsWith('backup-') && f.endsWith('.json')
          ) || backup.files.find((f) => f.endsWith('.json'));
        const planPromise = fetchRestorePlan(backup.timestamp)
          .then((plan) => {
            setRestorePlan(plan);
            setRestorePlanError(null);
          })
          .catch((planError) => {
            setRestorePlanError(
              planError instanceof Error
                ? planError.message
                : 'Failed to load restore plan'
            );
          })
          .finally(() => {
            setRestorePlanLoading(false);
          });
        const changesPromise = fetchBackupChanges(backup.timestamp)
          .then((comparison) => {
            setBackupChanges(comparison);
            setBackupChangesError(null);

            const preferredTable =
              comparison.entries.find(
                (entry) =>
                  entry.coverage !== 'dump-only' &&
                  entry.status !== 'missing' &&
                  entry.backupCount <= 2000 &&
                  entry.currentCount <= 2000 &&
                  entry.status !== 'unchanged'
              )?.key ??
              comparison.entries.find(
                (entry) =>
                  entry.coverage !== 'dump-only' &&
                  entry.status !== 'missing' &&
                  entry.backupCount <= 2000 &&
                  entry.currentCount <= 2000
              )?.key ??
              null;

            if (!preferredTable) {
              setSummaryComparison(null);
              setSummaryComparisonTable(null);
              setSummaryComparisonError(
                'Detailed before/after comparison is available only for smaller JSON-backed tables.'
              );
              return;
            }

            setSummaryComparisonTable(preferredTable);
            setSummaryComparisonLoading(true);
            setSummaryComparisonError(null);
            void fetchBackupChangePreview(backup.timestamp, preferredTable)
              .then((preview) => {
                setSummaryComparison(preview);
              })
              .catch((error) => {
                setSummaryComparison(null);
                setSummaryComparisonError(
                  error instanceof Error
                    ? error.message
                    : 'Failed to load before/after comparison'
                );
              })
              .finally(() => {
                setSummaryComparisonLoading(false);
              });
          })
          .catch((changesError) => {
            setBackupChangesError(
              changesError instanceof Error
                ? changesError.message
                : 'Failed to load backup changes'
            );
          })
          .finally(() => {
            setBackupChangesLoading(false);
          });

        if (jsonFile) {
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
        }

        await Promise.all([planPromise, changesPromise]);
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
        setRestorePlan(null);
        setRestorePlanError(null);
        setBackupChanges(null);
        setBackupChangesError(null);
        setSummaryComparisonTable(null);
        setSummaryComparison(null);
        setSummaryComparisonError(null);
        setSummaryComparisonSelectedRows([]);
      } finally {
        setPreviewLoading(false);
        setRestorePlanLoading(false);
        setBackupChangesLoading(false);
      }
    },
    [
      PREVIEW_SUMMARY_TIMEOUT_MS,
      fetchBackupChanges,
      fetchBackupChangePreview,
      fetchRestorePlan,
      fetchTableSample,
      pageTab,
    ]
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

  const handleRunRestore = useCallback(async () => {
    if (!selectedBackup) {
      return;
    }

    const expectedConfirmation = `RESTORE ${selectedBackup.timestamp}`;
    const dumpFileName =
      selectedBackup.files.find((file) => file.endsWith('.dump')) ?? null;

    if (!dumpFileName) {
      showNotification({
        title: 'Restore unavailable',
        message: 'This backup does not include a PostgreSQL dump artifact.',
        color: 'red',
      });
      return;
    }

    const Swal = await getSwal();
    const confirmation = await Swal.fire({
      title: 'Queue destructive restore?',
      width: 560,
      html: `
        <div style="text-align: left; font-size: 15px; line-height: 1.5;">
          <p><strong>Backup:</strong> ${formatBackupTimestamp(selectedBackup.timestamp)}</p>
          <p><strong>Dump file:</strong> ${dumpFileName}</p>
          <p style="margin-top: 12px; color: #c92a2a;"><strong>This will stop the app and replace the current Docker database.</strong></p>
          <p>The browser may become temporarily unavailable until the restore completes.</p>
          <p style="margin-top: 12px;">Type <strong>${expectedConfirmation}</strong> to continue.</p>
        </div>
      `,
      input: 'text',
      inputPlaceholder: expectedConfirmation,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Queue restore',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#c92a2a',
      cancelButtonColor: '#868e96',
      allowOutsideClick: false,
      preConfirm: (value) => {
        if (value?.trim() !== expectedConfirmation) {
          Swal.showValidationMessage(
            `Please type ${expectedConfirmation} to continue.`
          );
          return false;
        }

        return value.trim();
      },
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    setRestoreSubmitting(true);

    try {
      const response = await fetchWithTimeout(
        '/api/restore/run',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            timestamp: selectedBackup.timestamp,
            confirmationText: expectedConfirmation,
          }),
        },
        15000
      );

      const payload = (await response.json()) as {
        success: boolean;
        message?: string;
        error?: string;
        runnerAvailable?: boolean;
        runnerHeartbeatAt?: string | null;
        status?: RestoreJobStatus | null;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to submit restore request');
      }

      setRestoreRunnerAvailable(Boolean(payload.runnerAvailable));
      setRestoreRunnerHeartbeatAt(payload.runnerHeartbeatAt ?? null);
      setRestoreJobStatus(payload.status ?? null);

      showNotification({
        title: 'Restore queued',
        message:
          payload.message ||
          'The restore runner accepted the request. The app may become temporarily unavailable while the database is replaced.',
        color: 'yellow',
        autoClose: 8000,
      });
    } catch (error) {
      showNotification({
        title: 'Restore request failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setRestoreSubmitting(false);
      void fetchRestoreRunnerStatus();
    }
  }, [fetchRestoreRunnerStatus, selectedBackup]);

  const handleOpenBackupChangePreview = useCallback(
    async (table: string) => {
      if (!selectedBackup) {
        return;
      }

      setBackupChangePreviewOpen(true);
      setBackupChangePreviewLoading(true);
      setBackupChangePreviewError(null);
      setBackupChangePreview(null);
      setBackupChangePreviewTable(table);
      setBackupChangePreviewSelectedRow(null);

      try {
        setBackupChangePreview(
          await fetchBackupChangePreview(selectedBackup.timestamp, table)
        );
      } catch (error) {
        setBackupChangePreviewError(
          error instanceof Error
            ? error.message
            : 'Failed to load detailed change preview'
        );
      } finally {
        setBackupChangePreviewLoading(false);
      }
    },
    [fetchBackupChangePreview, selectedBackup]
  );

  const handleSelectSummaryComparisonTable = useCallback(
    async (table: string | null) => {
      if (!selectedBackup || !table) {
        setSummaryComparisonTable(table);
        setSummaryComparison(null);
        setSummaryComparisonSelectedRows([]);
        return;
      }

      setSummaryComparisonTable(table);
      setSummaryComparisonLoading(true);
      setSummaryComparisonError(null);
      setSummaryComparison(null);
      setSummaryComparisonSelectedRows([]);

      try {
        setSummaryComparison(
          await fetchBackupChangePreview(selectedBackup.timestamp, table)
        );
      } catch (error) {
        setSummaryComparisonError(
          error instanceof Error
            ? error.message
            : 'Failed to load before/after comparison'
        );
      } finally {
        setSummaryComparisonLoading(false);
      }
    },
    [fetchBackupChangePreview, selectedBackup]
  );

  useEffect(() => {
    if (!backupChangePreview) {
      setBackupChangePreviewSelectedRow(null);
      return;
    }

    const typeOptions = getBackupChangePreviewTypeOptions(backupChangePreview);
    const currentTypeIsValid = typeOptions.some(
      (option) => option.value === backupChangePreviewType
    );
    const nextType = currentTypeIsValid
      ? backupChangePreviewType
      : (typeOptions[0]?.value ?? 'added');

    if (nextType !== backupChangePreviewType) {
      setBackupChangePreviewType(nextType);
      return;
    }

    const rowOptions = getBackupChangePreviewRowOptions(
      backupChangePreview,
      nextType
    );
    const hasCurrentRow = rowOptions.some(
      (option) => option.value === backupChangePreviewSelectedRow
    );

    if (!hasCurrentRow) {
      setBackupChangePreviewSelectedRow(rowOptions[0]?.value ?? null);
    }
  }, [
    backupChangePreview,
    backupChangePreviewSelectedRow,
    backupChangePreviewType,
  ]);

  useEffect(() => {
    if (!summaryComparison) {
      if (summaryComparisonSelectedRows.length > 0) {
        setSummaryComparisonSelectedRows([]);
      }
      return;
    }

    const typeOptions = getBackupChangePreviewTypeOptions(summaryComparison);
    const currentTypeIsValid = typeOptions.some(
      (option) => option.value === summaryComparisonType
    );
    const nextType = currentTypeIsValid
      ? summaryComparisonType
      : (typeOptions[0]?.value ?? 'added');

    if (nextType !== summaryComparisonType) {
      setSummaryComparisonType(nextType);
      return;
    }

    const rowOptions = getBackupChangePreviewRowOptions(
      summaryComparison,
      nextType
    );
    const rowOptionValues = new Set(rowOptions.map((option) => option.value));
    const nextSelectedRows = summaryComparisonSelectedRows.filter((value) =>
      rowOptionValues.has(value)
    );
    const fallbackSelectedRows = rowOptions
      .slice(0, 3)
      .map((option) => option.value);
    const resolvedSelectedRows =
      nextSelectedRows.length > 0 ? nextSelectedRows : fallbackSelectedRows;
    const selectionChanged =
      resolvedSelectedRows.length !== summaryComparisonSelectedRows.length ||
      resolvedSelectedRows.some(
        (value, index) => value !== summaryComparisonSelectedRows[index]
      );

    if (selectionChanged) {
      setSummaryComparisonSelectedRows(resolvedSelectedRows);
    }
  }, [summaryComparison, summaryComparisonSelectedRows, summaryComparisonType]);

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

    const validTableNames = summaries.map((table) => table.name);
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

  useEffect(() => {
    if (!previewModalOpen) {
      return;
    }

    void fetchRestoreRunnerStatus();

    const intervalId = window.setInterval(() => {
      void fetchRestoreRunnerStatus();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchRestoreRunnerStatus, previewModalOpen]);

  const {
    handleDownloadJSON,
    handleDownloadDump,
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

  const activeTableName =
    isAdminBackupRestore && sidebarSelectedTable
      ? sidebarSelectedTable
      : selectedTableName;

  const selectedTableDetails = useMemo(() => {
    return getSelectedTableDetails(previewData, activeTableName);
  }, [previewData, activeTableName]);

  const selectedDumpFileName = useMemo(
    () => selectedBackup?.files.find((file) => file.endsWith('.dump')) ?? null,
    [selectedBackup]
  );

  const summaryComparisonTableOptions = useMemo(() => {
    if (!backupChanges) {
      return [];
    }

    return backupChanges.entries
      .filter(
        (entry) =>
          entry.coverage !== 'dump-only' &&
          entry.status !== 'missing' &&
          entry.backupCount <= 2000 &&
          entry.currentCount <= 2000
      )
      .sort((left, right) => {
        if (left.status === 'unchanged' && right.status !== 'unchanged') {
          return 1;
        }
        if (left.status !== 'unchanged' && right.status === 'unchanged') {
          return -1;
        }
        return left.key.localeCompare(right.key);
      })
      .map((entry) => ({
        value: entry.key,
        label:
          entry.status === 'unchanged'
            ? `${entry.key} — no count drift`
            : `${entry.key} — ${entry.delta > 0 ? '+' : ''}${entry.delta} rows`,
      }));
  }, [backupChanges]);

  const summaryComparisonSelectedRowsData = useMemo(() => {
    return getBackupChangePreviewSelectedRowsData(
      summaryComparison,
      summaryComparisonSelectedRows,
      summaryComparisonType
    );
  }, [summaryComparison, summaryComparisonSelectedRows, summaryComparisonType]);

  const restoreDisabledReason = useMemo(() => {
    if (!selectedDumpFileName) {
      return 'This backup does not include a PostgreSQL dump artifact.';
    }

    if (restorePlanLoading) {
      return 'Restore planning is still loading.';
    }

    if (!restorePlan?.disasterRecoveryReady) {
      return 'Only full PostgreSQL dump backups are currently restorable from the UI.';
    }

    if (!restoreRunnerAvailable) {
      return 'The restore-runner service is offline.';
    }

    if (
      restoreJobStatus?.phase === 'pending' ||
      restoreJobStatus?.phase === 'running'
    ) {
      return restoreJobStatus.backupFolder === selectedBackup?.timestamp
        ? 'A restore for this backup is already pending or running.'
        : `Another restore job (${restoreJobStatus.backupFolder}) is already pending or running.`;
    }

    return null;
  }, [
    restoreJobStatus,
    restorePlan,
    restorePlanLoading,
    restoreRunnerAvailable,
    selectedBackup?.timestamp,
    selectedDumpFileName,
  ]);

  const { strategySchedule } = useBackupSchedule(backups);

  const controlTabs: ControlPanelTabConfig[] = [
    {
      value: 'backup',
      label: 'Create',
      leftSection: <IconDatabase size={16} />,
    },
    {
      value: 'restore',
      label: 'Restore',
      leftSection: <IconHistory size={16} />,
    },
    {
      value: 'tables',
      label: 'Browse Data',
      leftSection: <IconTable size={16} />,
      panel: (
        <BackupTablesActionPanel
          tableSearchQuery={tableSearchQuery}
          onSearchQueryChange={setTableSearchQuery}
          backupDateOptions={backupDateOptions}
          selectedBackupTimestamp={selectedBackup?.timestamp ?? null}
          onBackupDateFilterChange={handleBackupDateFilterChange}
          selectedTableName={selectedTableName}
          previewData={previewData}
          selectedBackup={selectedBackup}
          onDownloadCSV={handleDownloadCSV}
          onDownloadXLSX={handleDownloadXLSX}
          onDownloadJSON={handleDownloadJSON}
          onDownloadDump={handleDownloadDump}
          onDownloadAllCSV={handleDownloadAllCSV}
          onDownloadAllXLSX={handleDownloadAllXLSX}
        />
      ),
    },
  ];

  return (
    <Stack gap="lg">
      <ControlPanelCard
        title="Backups"
        tabs={controlTabs}
        activeTab={pageTab}
        onTabChange={(value) =>
          setPageTab((value as 'backup' | 'restore' | 'tables') ?? 'backup')
        }
      />

      {pageTab === 'backup' ? (
        <Stack gap="lg">
          <BackupSection
            backups={backups}
            loading={loading}
            creating={creating}
            backupStrategy={backupStrategy}
            strategyOptions={strategyOptions}
            backupFormat={backupFormat}
            isLogStrategy={isLogStrategy}
            includeSoftDeleted={includeSoftDeleted}
            strategySchedule={strategySchedule}
            onBackupStrategyChange={setBackupStrategy}
            onBackupFormatChange={setBackupFormat}
            onIncludeSoftDeletedChange={setIncludeSoftDeleted}
            onCreateBackup={() => void handleCreateBackup()}
            onRefresh={() => void fetchBackups()}
            onPreview={handlePreviewBackup}
            onDelete={(backup) => void handleDeleteBackup(backup.timestamp)}
          />

          <PitrStatusCard
            status={pitrStatus}
            loading={pitrStatusLoading}
            creating={pitrCreating}
            onRefresh={() => void fetchPitrStatus()}
            onCreateBaseBackup={() => void handleCreatePitrBaseBackup()}
          />
        </Stack>
      ) : null}

      {pageTab === 'restore' ? (
        <RestoreSection
          backups={backups}
          loading={loading}
          onRefresh={() => void fetchBackups()}
          onPreview={handlePreviewBackup}
          onDelete={(backup) => void handleDeleteBackup(backup.timestamp)}
        />
      ) : null}

      {pageTab === 'tables' ? (
        <TablePreviewSection
          previewLoading={previewLoading}
          previewData={previewData}
          activeTableName={activeTableName}
          selectedTableDetails={selectedTableDetails}
          searchQuery={tableSearchQuery}
          isAdminBackupRestore={isAdminBackupRestore}
          onSelectTable={handleSelectPreviewTable}
        />
      ) : null}

      <BackupPreviewModal
        opened={previewModalOpen}
        loading={previewLoading}
        previewData={previewData}
        backupChanges={backupChanges}
        backupChangesLoading={backupChangesLoading}
        backupChangesError={backupChangesError}
        summaryComparisonTableOptions={summaryComparisonTableOptions}
        summaryComparisonTable={summaryComparisonTable}
        summaryComparisonLoading={summaryComparisonLoading}
        summaryComparison={summaryComparison}
        summaryComparisonError={summaryComparisonError}
        summaryComparisonTypeOptions={getBackupChangePreviewTypeOptions(
          summaryComparison
        )}
        summaryComparisonType={summaryComparisonType}
        summaryComparisonRowOptions={getBackupChangePreviewRowOptions(
          summaryComparison,
          summaryComparisonType
        )}
        summaryComparisonSelectedRows={summaryComparisonSelectedRows}
        summaryComparisonSelectedRowsData={summaryComparisonSelectedRowsData}
        restorePlan={restorePlan}
        restorePlanLoading={restorePlanLoading}
        restorePlanError={restorePlanError}
        restoreRunnerAvailable={restoreRunnerAvailable}
        restoreRunnerHeartbeatAt={restoreRunnerHeartbeatAt}
        restoreJobStatus={restoreJobStatus}
        restoreJobLoading={restoreJobLoading}
        restoreSubmitting={restoreSubmitting}
        selectedBackupTimestamp={selectedBackup?.timestamp ?? null}
        selectedDumpFileName={selectedDumpFileName}
        restoreDisabledReason={restoreDisabledReason}
        selectedTableName={selectedTableName}
        selectedTableDetails={selectedTableDetails}
        canDownloadJson={Boolean(previewJsonFile && selectedBackup)}
        canDownloadDump={Boolean(
          selectedBackup?.files.some((file) => file.endsWith('.dump'))
        )}
        onClose={() => setPreviewModalOpen(false)}
        onSelectSummaryComparisonTable={(table) =>
          void handleSelectSummaryComparisonTable(table)
        }
        onSelectSummaryComparisonType={setSummaryComparisonType}
        onSelectSummaryComparisonRows={setSummaryComparisonSelectedRows}
        onSelectTable={(table) => void handleSelectPreviewTable(table)}
        onDownloadJSON={() =>
          selectedBackup ? void handleDownloadJSON(selectedBackup) : undefined
        }
        onDownloadDump={() =>
          selectedBackup ? void handleDownloadDump(selectedBackup) : undefined
        }
        onDownloadAllCSV={() => void handleDownloadAllCSV()}
        onDownloadAllXLSX={() => void handleDownloadAllXLSX()}
        onDownloadCSV={(table) => void handleDownloadCSV(table)}
        onDownloadXLSX={(table) => void handleDownloadXLSX(table)}
        onPreviewChangeTable={(table) =>
          void handleOpenBackupChangePreview(table)
        }
        onRestore={() => void handleRunRestore()}
      />

      <BackupChangeDetailModal
        opened={backupChangePreviewOpen}
        loading={backupChangePreviewLoading}
        tableName={backupChangePreviewTable}
        preview={backupChangePreview}
        error={backupChangePreviewError}
        changeTypeOptions={getBackupChangePreviewTypeOptions(
          backupChangePreview
        )}
        selectedChangeType={backupChangePreviewType}
        onChangeType={setBackupChangePreviewType}
        rowOptions={getBackupChangePreviewRowOptions(
          backupChangePreview,
          backupChangePreviewType
        )}
        selectedRow={backupChangePreviewSelectedRow}
        onSelectRow={setBackupChangePreviewSelectedRow}
        rowData={getBackupChangePreviewSelectedRowData(
          backupChangePreview,
          backupChangePreviewSelectedRow,
          backupChangePreviewType
        )}
        onClose={() => setBackupChangePreviewOpen(false)}
      />
    </Stack>
  );
}
