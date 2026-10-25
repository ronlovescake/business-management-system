import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { BackupRestoreTab } from '@/modules/clothing/operations/settings/components/BackupRestoreTab';

const {
  mockApiGet,
  mockFetchWithTimeout,
  mockSetSidebarActive,
  mockClearSidebar,
  mockUsePathname,
} = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockFetchWithTimeout: vi.fn(),
  mockSetSidebarActive: vi.fn(),
  mockClearSidebar: vi.fn(),
  mockUsePathname: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
}));

vi.mock('@mantine/notifications', () => ({
  showNotification: vi.fn(),
}));

vi.mock('@/lib/alerts', () => ({
  getSwal: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    get: mockApiGet,
  },
}));

vi.mock(
  '@/modules/clothing/operations/settings/backup/hooks/useBackupSchedule',
  () => ({
    useBackupSchedule: () => ({
      strategySchedule: [],
    }),
  })
);

vi.mock(
  '@/modules/clothing/operations/settings/components/backup-restore/useBackupDownloadHandlers',
  () => ({
    useBackupDownloadHandlers: () => ({
      handleDownloadJSON: vi.fn(),
      handleDownloadDump: vi.fn(),
      handleDownloadXLSX: vi.fn(),
      handleDownloadAllXLSX: vi.fn(),
      handleDownloadCSV: vi.fn(),
      handleDownloadAllCSV: vi.fn(),
    }),
  })
);

vi.mock(
  '@/modules/clothing/operations/settings/components/backup-restore/backupRestoreSidebarStore',
  () => ({
    useBackupRestoreSidebarStore: () => ({
      tables: [],
      selectedTable: null,
      setActive: mockSetSidebarActive,
      setTables: vi.fn(),
      setSelectedTable: vi.fn(),
      clear: mockClearSidebar,
    }),
  })
);

vi.mock(
  '@/modules/clothing/operations/settings/components/backup-restore/backupRestoreTabUtils',
  () => ({
    areBackupSidebarTablesEqual: vi.fn(() => true),
    buildBackupTableSampleUrl: vi.fn(() => '/api/sample'),
    fetchWithTimeout: mockFetchWithTimeout,
    getBackupChangePreviewRowOptions: vi.fn(() => []),
    getBackupChangePreviewSelectedRowsData: vi.fn(() => []),
    getBackupChangePreviewSelectedRowData: vi.fn(() => null),
    getBackupChangePreviewTypeOptions: vi.fn(() => []),
    getSelectedTableDetails: vi.fn(() => null),
  })
);

vi.mock('@/components/ui/ControlPanelCard', () => ({
  ControlPanelCard: ({
    title,
    tabs,
    activeTab,
    onTabChange,
  }: {
    title: string;
    tabs: Array<{ value: string; label: string }>;
    activeTab: string;
    onTabChange: (value: string) => void;
  }) => (
    <div>
      <div>{title}</div>
      <div>active-tab:{activeTab}</div>
      {tabs.map((tab) => (
        <button key={tab.value} onClick={() => onTabChange(tab.value)}>
          {tab.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock(
  '@/modules/clothing/operations/settings/components/backup-restore/BackupWorkspace',
  () => ({
    BackupWorkspace: ({
      backups,
      runnerAvailable,
      createForm,
    }: {
      backups: unknown[];
      runnerAvailable: boolean;
      createForm: React.ReactNode;
    }) => (
      <div>
        <div>snapshot-count:{backups.length}</div>
        <div>runner-online:{String(runnerAvailable)}</div>
        {createForm}
      </div>
    ),
  })
);

vi.mock(
  '@/modules/clothing/operations/settings/components/backup-restore/BackupSection',
  () => ({
    BackupSection: ({ backups }: { backups: Array<unknown> }) => (
      <div>backup-count:{backups.length}</div>
    ),
  })
);

vi.mock(
  '@/modules/clothing/operations/settings/components/backup-restore/PitrStatusCard',
  () => ({
    PitrStatusCard: ({ status }: { status: { enabled?: boolean } | null }) => (
      <div>pitr-enabled:{String(Boolean(status?.enabled))}</div>
    ),
  })
);

vi.mock(
  '@/modules/clothing/operations/settings/components/backup-restore/RestoreSection',
  () => ({
    RestoreSection: () => <div>restore-section</div>,
  })
);

vi.mock(
  '@/modules/clothing/operations/settings/components/backup-restore/TablePreviewSection',
  () => ({
    TablePreviewSection: ({
      isAdminBackupRestore,
    }: {
      isAdminBackupRestore: boolean;
    }) => <div>tables-admin:{String(isAdminBackupRestore)}</div>,
  })
);

vi.mock(
  '@/modules/clothing/operations/settings/components/backup-restore/BackupPreviewModal',
  () => ({
    BackupPreviewModal: () => null,
  })
);

vi.mock(
  '@/modules/clothing/operations/settings/components/backup-restore/BackupChangeDetailModal',
  () => ({
    BackupChangeDetailModal: () => null,
  })
);

vi.mock(
  '@/modules/clothing/operations/settings/components/backup-restore/BackupTablesActionPanel',
  () => ({
    BackupTablesActionPanel: () => <div>tables-action-panel</div>,
  })
);

function renderTab() {
  return render(
    <MantineProvider>
      <BackupRestoreTab />
    </MantineProvider>
  );
}

describe('BackupRestoreTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/settings');
    mockApiGet.mockImplementation(async (path: string) => {
      if (path === '/api/backup') {
        return {
          success: true,
          backups: [
            {
              timestamp: '2026-04-06T00:00:00.000Z',
              path: '/tmp/backup',
              files: ['snapshot.dump'],
              totalSize: 128,
              strategy: 'full',
            },
          ],
        };
      }

      if (path === '/api/backup/pitr') {
        return {
          success: true,
          status: {
            enabled: true,
            baseBackupDirectory: '/tmp/base',
            walArchiveDirectory: '/tmp/wal',
            schedule: {
              enabled: false,
              time: null,
              timeZone: null,
            },
            baseBackupCount: 0,
            latestBaseBackup: null,
            walArchiveFileCount: 0,
            walArchiveTotalSize: 0,
            latestArchivedWalFile: null,
            latestArchivedWalMtime: null,
            runtime: {
              archiveMode: null,
              archiveCommand: null,
              archiveTimeout: null,
              walLevel: null,
              archivedCount: 0,
              failedCount: 0,
              lastArchivedWal: null,
              lastArchivedAt: null,
              lastFailedWal: null,
              lastFailedAt: null,
              statsResetAt: null,
              databaseConnected: true,
            },
            recoveryWindow: {
              start: null,
              end: null,
            },
            restoreCommandPreview: null,
          },
        };
      }

      throw new Error(`Unhandled api.get call: ${path}`);
    });

    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        runnerAvailable: true,
        runnerHeartbeatAt: '2026-04-06T01:00:00.000Z',
        status: null,
      }),
    });
  });

  it('loads snapshots into the workspace without replacing global navigation', async () => {
    renderTab();

    await screen.findByText('backup-count:1');

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/backup');
    });
    expect(mockSetSidebarActive).not.toHaveBeenCalled();
    expect(screen.getByText('snapshot-count:1')).toBeInTheDocument();
  });

  it('shows runner availability in the workspace', async () => {
    renderTab();

    await screen.findByText('backup-count:1');
    expect(await screen.findByText('runner-online:true')).toBeInTheDocument();
  });
});
