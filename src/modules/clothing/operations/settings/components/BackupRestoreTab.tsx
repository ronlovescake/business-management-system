'use client';

import React from 'react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Stack } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { getSwal } from '@/lib/alerts';
import { api } from '@/lib/api/client';
import { usePathname } from 'next/navigation';
import { IconDatabase, IconHistory, IconTable } from '@tabler/icons-react';
import type { Backup, BackupStrategy } from '../backup/types';
import { STRATEGY_META, formatBackupTimestamp } from '../backup/types';
import { useBackupSchedule } from '../backup/hooks/useBackupSchedule';
import { BackupPreviewModal } from './backup-restore/BackupPreviewModal';
import { BackupChangeDetailModal } from './backup-restore/BackupChangeDetailModal';
import { useBackupDownloadHandlers } from './backup-restore/useBackupDownloadHandlers';
import { useBackupRestorePreviewController } from './backup-restore/useBackupRestorePreviewController';
import { BackupTablesActionPanel } from './backup-restore/BackupTablesActionPanel';
import { BackupSection } from './backup-restore/BackupSection';

import { RestoreSection } from './backup-restore/RestoreSection';
import { TablePreviewSection } from './backup-restore/TablePreviewSection';
import {
  ControlPanelCard,
  type ControlPanelTabConfig,
} from '@/components/ui/ControlPanelCard';
import {
  getBackupChangePreviewRowOptions,
  getBackupChangePreviewSelectedRowsData,
  getBackupChangePreviewSelectedRowData,
  getBackupChangePreviewTypeOptions,
  getSelectedTableDetails,
} from './backup-restore/backupRestoreTabUtils';

export function BackupRestoreTab() {
  const pathname = usePathname();
  const isAdminBackupRestore = Boolean(
    pathname?.startsWith('/admin/backup-restore') ||
      pathname?.startsWith('/settings')
  );

  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [backupFormat, setBackupFormat] = useState<string>('all');
  const [backupStrategy, setBackupStrategy] = useState<BackupStrategy>('full');
  const [includeSoftDeleted, setIncludeSoftDeleted] = useState(false);

  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [pageTab, setPageTab] = useState<'backup' | 'restore' | 'tables'>(
    'backup'
  );

  const {
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
  } = useBackupRestorePreviewController({
    backups,
    isAdminBackupRestore,
    pageTab,
  });

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
        }>(
          '/api/backup',
          {
            format: formatToUse,
            includeSoftDeleted,
            strategy: strategyToUse,
          },
          {
            // Backup operations are not idempotent and can be time-consuming
            // Disable retries to prevent duplicate backups on timeout
            // Use extended timeout (5 minutes) since backups can take a while
            retryEnabled: false,
            timeout: 5 * 60 * 1000,
          }
        );

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
        `/api/backup?timestamp=${encodeURIComponent(timestamp)}`,
        // Deletion of large backup folders can take significant time
        { timeout: 5 * 60 * 1000, retryEnabled: false }
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

  const selectedTableDetails = useMemo(() => {
    return getSelectedTableDetails(previewData, activeTableName);
  }, [previewData, activeTableName]);

  const restoreBaselineDumpFileName = useMemo(
    () =>
      restorePlan?.steps.find((step) => step.action === 'restore-full-dump')
        ?.artifactName ?? null,
    [restorePlan]
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
    if (restorePlanLoading) {
      return 'Restore planning is still loading.';
    }

    if (!restoreBaselineDumpFileName) {
      return 'This restore plan does not include a PostgreSQL dump baseline.';
    }

    if (!restorePlan?.disasterRecoveryReady) {
      return restorePlan?.status === 'invalid'
        ? 'This backup has a broken restore chain.'
        : 'This backup is missing one or more executable restore artifacts.';
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
    restoreBaselineDumpFileName,
    selectedBackup?.timestamp,
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
        selectedDumpFileName={restoreBaselineDumpFileName}
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
