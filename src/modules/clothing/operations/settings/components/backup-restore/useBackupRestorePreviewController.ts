'use client';

import { useCallback, useEffect, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import { getSwal } from '@/lib/alerts';
import {
  areBackupSidebarTablesEqual,
  buildBackupTableSampleUrl,
  fetchWithTimeout,
  getBackupChangePreviewRowOptions,
  getBackupChangePreviewTypeOptions,
} from './backupRestoreTabUtils';
import { useBackupRestoreSidebarStore } from './backupRestoreSidebarStore';
import type {
  Backup,
  BackupData,
  BackupChangePreview,
  BackupChangesComparison,
  RestoreJobStatus,
  RestorePlan,
} from '../../backup/types';
import { formatBackupTimestamp } from '../../backup/types';

const TABLE_SAMPLE_LIMIT = 250;
const PREVIEW_SUMMARY_TIMEOUT_MS = 120000;
const PREVIEW_TABLE_TIMEOUT_MS = 180000;

type UseBackupRestorePreviewControllerOptions = {
  backups: Backup[];
  isAdminBackupRestore: boolean;
  pageTab: 'backup' | 'restore' | 'tables';
};

export function useBackupRestorePreviewController({
  backups,
  isAdminBackupRestore,
  pageTab,
}: UseBackupRestorePreviewControllerOptions) {
  const {
    tables: sidebarTables,
    selectedTable: sidebarSelectedTable,
    setActive: setSidebarActive,
    setTables: setSidebarTables,
    setSelectedTable: setSidebarSelectedTable,
    clear: clearSidebar,
  } = useBackupRestoreSidebarStore();

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
  const [restoreJobStatus, setRestoreJobStatus] =
    useState<RestoreJobStatus | null>(null);
  const [restoreJobLoading, setRestoreJobLoading] = useState(false);
  const [restoreSubmitting, setRestoreSubmitting] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(
    null
  );
  const [previewJsonFile, setPreviewJsonFile] = useState<string | null>(null);

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
    []
  );

  const fetchRestorePlan = useCallback(async (timestamp: string) => {
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
  }, []);

  const fetchBackupChanges = useCallback(async (timestamp: string) => {
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
  }, []);

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
            (file) => file.includes('backup-') && file.endsWith('.json')
          ) || backup.files.find((file) => file.endsWith('.json'));

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

        const isFullBackup = !backup.strategy || backup.strategy === 'full';

        const changesPromise = isFullBackup
          ? fetchBackupChanges(backup.timestamp)
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
          })
          : Promise.resolve().then(() => {
              setBackupChangesLoading(false);
              setBackupChangesError(
                'Change summaries are only available for full backups.'
              );
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
      fetchBackupChangePreview,
      fetchBackupChanges,
      fetchRestorePlan,
      fetchTableSample,
      pageTab,
    ]
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
      fetchTableSample,
      previewData,
      previewJsonFile,
      selectedBackup,
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
    setSidebarSelectedTable,
    setSidebarTables,
    sidebarSelectedTable,
    sidebarTables,
  ]);

  useEffect(() => {
    if (!isAdminBackupRestore || !sidebarSelectedTable) {
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
    handleSelectPreviewTable,
    isAdminBackupRestore,
    previewData,
    selectedTableName,
    sidebarSelectedTable,
  ]);

  useEffect(() => {
    if (!isAdminBackupRestore) {
      return;
    }

    setSidebarActive(true);

    return () => {
      clearSidebar();
    };
  }, [clearSidebar, isAdminBackupRestore, setSidebarActive]);

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

  const activeTableName =
    isAdminBackupRestore && sidebarSelectedTable
      ? sidebarSelectedTable
      : selectedTableName;

  return {
    activeTableName,
    backupChangePreview,
    backupChangePreviewError,
    backupChangePreviewLoading,
    backupChangePreviewOpen,
    backupChangePreviewSelectedRow,
    backupChangePreviewTable,
    backupChangePreviewType,
    backupChanges,
    backupChangesError,
    backupChangesLoading,
    fetchTableSample,
    handleBackupDateFilterChange,
    handleOpenBackupChangePreview,
    handlePreviewBackup,
    handleRunRestore,
    handleSelectPreviewTable,
    handleSelectSummaryComparisonTable,
    previewData,
    previewJsonFile,
    previewLoading,
    previewModalOpen,
    restoreJobLoading,
    restoreJobStatus,
    restorePlan,
    restorePlanError,
    restorePlanLoading,
    restoreRunnerAvailable,
    restoreRunnerHeartbeatAt,
    restoreSubmitting,
    selectedBackup,
    selectedTableName,
    setBackupChangePreviewOpen,
    setBackupChangePreviewSelectedRow,
    setBackupChangePreviewType,
    setPreviewModalOpen,
    setSummaryComparisonSelectedRows,
    setSummaryComparisonType,
    summaryComparison,
    summaryComparisonError,
    summaryComparisonLoading,
    summaryComparisonSelectedRows,
    summaryComparisonTable,
    summaryComparisonType,
  };
}
