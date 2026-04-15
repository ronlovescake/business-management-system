import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSwal } from '@/lib/alerts';
import { showNotification } from '@mantine/notifications';
import { useBackupRestorePreviewController } from '@/modules/clothing/operations/settings/components/backup-restore/useBackupRestorePreviewController';
import type { Backup } from '@/modules/clothing/operations/settings/backup/types';

const {
  mockFetchWithTimeout,
  mockSetSidebarActive,
  mockClearSidebar,
} = vi.hoisted(() => ({
  mockFetchWithTimeout: vi.fn(),
  mockSetSidebarActive: vi.fn(),
  mockClearSidebar: vi.fn(),
}));

vi.mock('@mantine/notifications', () => ({
  showNotification: vi.fn(),
}));

vi.mock('@/lib/alerts', () => ({
  getSwal: vi.fn(),
}));

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
    getBackupChangePreviewTypeOptions: vi.fn(() => []),
  })
);

const differentialBackup: Backup = {
  timestamp: '2026-04-14T15-00-21-differential-backup',
  path: '/tmp/diff-backup',
  files: ['differential-backup-2026-04-14T15-00-21.json'],
  totalSize: 746842,
  strategy: 'differential',
};

describe('useBackupRestorePreviewController', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getSwal).mockResolvedValue({
      fire: vi.fn().mockResolvedValue({ isConfirmed: true }),
      showValidationMessage: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof getSwal>>);

    mockFetchWithTimeout.mockImplementation(
      async (input: string, init?: RequestInit) => {
        if (input === '/api/restore/run' && !init) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              runnerAvailable: true,
              runnerHeartbeatAt: '2026-04-15T04:00:00.000Z',
              status: null,
            }),
          };
        }

        if (
          input ===
          '/api/backup/2026-04-14T15-00-21-differential-backup/plan'
        ) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              plan: {
                status: 'ready',
                targetFolder: '2026-04-14T15-00-21-differential-backup',
                targetTimestamp: '2026-04-14T15:00:21.000Z',
                targetStrategy: 'differential',
                chainFolders: [
                  '2026-04-12T14-00-54-full-backup',
                  '2026-04-14T15-00-21-differential-backup',
                ],
                steps: [
                  {
                    folder: '2026-04-12T14-00-54-full-backup',
                    timestamp: '2026-04-12T14:00:54.000Z',
                    strategy: 'full',
                    format: 'dump',
                    action: 'restore-full-dump',
                    supported: true,
                    artifactName: 'full-backup-2026-04-12T14-00-54.dump',
                    artifactPath:
                      '2026-04-12T14-00-54-full-backup/full-backup-2026-04-12T14-00-54.dump',
                  },
                  {
                    folder: '2026-04-14T15-00-21-differential-backup',
                    timestamp: '2026-04-14T15:00:21.000Z',
                    strategy: 'differential',
                    format: 'json',
                    action: 'apply-differential-json',
                    supported: true,
                    artifactName:
                      'differential-backup-2026-04-14T15-00-21.json',
                    artifactPath:
                      '2026-04-14T15-00-21-differential-backup/differential-backup-2026-04-14T15-00-21.json',
                  },
                ],
                warnings: [],
                errors: [],
                requiresReplayEngine: true,
                disasterRecoveryReady: true,
              },
            }),
          };
        }

        if (
          input ===
          '/api/backup/2026-04-14T15-00-21-differential-backup/differential-backup-2026-04-14T15-00-21.json?mode=summary'
        ) {
          return {
            ok: true,
            json: async () => ({
              metadata: {
                createdAt: '2026-04-14T15:00:21.000Z',
                database: 'business_management_system',
                format: 'json',
                version: '1',
                strategy: 'differential',
              },
              tables: {
                products: {
                  count: 1,
                  data: [],
                },
              },
            }),
          };
        }

        if (input === '/api/sample') {
          return {
            ok: true,
            json: async () => ({
              metadata: {
                createdAt: '2026-04-14T15:00:21.000Z',
                database: 'business_management_system',
                format: 'json',
                version: '1',
                strategy: 'differential',
              },
              tables: {
                products: {
                  count: 1,
                  data: [{ id: 1, name: 'Sample product' }],
                },
              },
            }),
          };
        }

        if (input === '/api/restore/run' && init?.method === 'POST') {
          return {
            ok: true,
            json: async () => ({
              success: true,
              message:
                'Restore job accepted. The application will become temporarily unavailable while the baseline dump is restored and the backup chain is replayed.',
              runnerAvailable: true,
              runnerHeartbeatAt: '2026-04-15T04:00:00.000Z',
              status: {
                phase: 'pending',
                backupFolder: '2026-04-14T15-00-21-differential-backup',
                requestedAt: '2026-04-15T04:01:00.000Z',
                requestedBy: 'test@example.com',
                scope: 'replay-chain',
                targetStrategy: 'differential',
                baselineBackupFolder: '2026-04-12T14-00-54-full-backup',
                dumpFileName: 'full-backup-2026-04-12T14-00-54.dump',
              },
            }),
          };
        }

        throw new Error(`Unhandled fetchWithTimeout call: ${input}`);
      }
    );
  });

  it('submits restore for a json-only differential backup when the planner provides a dump baseline', async () => {
    const { result } = renderHook(() =>
      useBackupRestorePreviewController({
        backups: [differentialBackup],
        isAdminBackupRestore: true,
        pageTab: 'restore',
      })
    );

    await waitFor(() => {
      expect(result.current.restoreRunnerAvailable).toBe(true);
    });

    await act(async () => {
      await result.current.handlePreviewBackup(differentialBackup);
    });

    await waitFor(() => {
      expect(result.current.restorePlan?.disasterRecoveryReady).toBe(true);
    });

    await act(async () => {
      await result.current.handleRunRestore();
    });

    const swal = await getSwal();
    expect(swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining(
          'Baseline dump:</strong> full-backup-2026-04-12T14-00-54.dump'
        ),
      })
    );

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      '/api/restore/run',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          timestamp: '2026-04-14T15-00-21-differential-backup',
          confirmationText:
            'RESTORE 2026-04-14T15-00-21-differential-backup',
        }),
      }),
      15000
    );

    expect(vi.mocked(showNotification)).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Restore unavailable',
      })
    );
  });
});
