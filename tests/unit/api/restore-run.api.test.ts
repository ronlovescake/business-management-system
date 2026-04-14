import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  mockBuildPendingRestoreJobStatus,
  mockIsRestoreJobActive,
  mockIsRestoreRunnerAvailable,
  mockReadRestoreJobStatus,
  mockReadRestoreRunnerHeartbeat,
  mockRequireBackupRestoreAdmin,
  mockResolveOperatorManagedRestoreTarget,
  mockWriteRestoreJobStatus,
  mockIsValidTimestampFolderName,
} = vi.hoisted(() => ({
  mockBuildPendingRestoreJobStatus: vi.fn(),
  mockIsRestoreJobActive: vi.fn(),
  mockIsRestoreRunnerAvailable: vi.fn(),
  mockReadRestoreJobStatus: vi.fn(),
  mockReadRestoreRunnerHeartbeat: vi.fn(),
  mockRequireBackupRestoreAdmin: vi.fn().mockResolvedValue(null),
  mockResolveOperatorManagedRestoreTarget: vi.fn(),
  mockWriteRestoreJobStatus: vi.fn(),
  mockIsValidTimestampFolderName: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/backup/restoreJobState', () => ({
  buildPendingRestoreJobStatus: mockBuildPendingRestoreJobStatus,
  isRestoreJobActive: mockIsRestoreJobActive,
  isRestoreRunnerAvailable: mockIsRestoreRunnerAvailable,
  readRestoreJobStatus: mockReadRestoreJobStatus,
  readRestoreRunnerHeartbeat: mockReadRestoreRunnerHeartbeat,
  resolveOperatorManagedRestoreTarget: mockResolveOperatorManagedRestoreTarget,
  writeRestoreJobStatus: mockWriteRestoreJobStatus,
}));

vi.mock('@/app/api/backup-restore/sharedRouteUtils', () => ({
  isValidTimestampFolderName: mockIsValidTimestampFolderName,
  requireBackupRestoreAdmin: mockRequireBackupRestoreAdmin,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { GET, POST } from '@/app/api/restore/run/route';

const ACTIVE_STATUS = {
  id: 'job-1',
  scope: 'full-dump' as const,
  phase: 'running' as const,
  backupFolder: '2026-04-04T02-00-00',
  baselineBackupFolder: '2026-04-04T02-00-00',
  targetStrategy: 'full' as const,
  dumpArtifactPath: '2026-04-04T02-00-00/backup.dump',
  dumpFileName: 'backup.dump',
  manifestTimestamp: '2026-04-04T02:00:00.000Z',
  requestedAt: '2026-04-04T03:00:00.000Z',
  updatedAt: '2026-04-04T03:00:10.000Z',
};

describe('Restore run API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockReadRestoreRunnerHeartbeat.mockReturnValue({
      service: 'restore-runner',
      version: 1,
      updatedAt: '2026-04-04T03:00:00.000Z',
    });
    mockReadRestoreJobStatus.mockReturnValue(null);
    mockIsRestoreRunnerAvailable.mockReturnValue(true);
    mockIsRestoreJobActive.mockReturnValue(false);
    mockResolveOperatorManagedRestoreTarget.mockReturnValue({
      scope: 'full-dump',
      folder: '2026-04-04T02-00-00',
      manifest: {
        timestamp: '2026-04-04T02:00:00.000Z',
      },
      targetStrategy: 'full',
      baselineFolder: '2026-04-04T02-00-00',
      dumpFileName: 'backup-2026-04-04T02-00-00.dump',
      dumpArtifactPath: '2026-04-04T02-00-00/backup-2026-04-04T02-00-00.dump',
      dumpAbsolutePath:
        '/backups/2026-04-04T02-00-00/backup-2026-04-04T02-00-00.dump',
    });
    mockBuildPendingRestoreJobStatus.mockReturnValue({
      id: 'job-2',
      scope: 'full-dump',
      phase: 'pending',
      backupFolder: '2026-04-04T02-00-00',
      baselineBackupFolder: '2026-04-04T02-00-00',
      targetStrategy: 'full',
      dumpArtifactPath: '2026-04-04T02-00-00/backup-2026-04-04T02-00-00.dump',
      dumpFileName: 'backup-2026-04-04T02-00-00.dump',
      manifestTimestamp: '2026-04-04T02:00:00.000Z',
      requestedAt: '2026-04-04T03:10:00.000Z',
      updatedAt: '2026-04-04T03:10:00.000Z',
      message: 'Restore request accepted.',
    });
    mockWriteRestoreJobStatus.mockImplementation(async (status) => status);
  });

  it('returns current runner availability and restore status', async () => {
    mockReadRestoreJobStatus.mockReturnValue(ACTIVE_STATUS);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.runnerAvailable).toBe(true);
    expect(payload.status.phase).toBe('running');
  });

  it('returns auth errors from the admin guard', async () => {
    mockRequireBackupRestoreAdmin.mockResolvedValueOnce(
      NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    );

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toContain('Authentication required');
  });

  it('rejects invalid confirmation text', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/restore/run', {
        method: 'POST',
        body: JSON.stringify({
          timestamp: '2026-04-04T02-00-00',
          confirmationText: 'RESTORE',
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('Type RESTORE 2026-04-04T02-00-00');
  });

  it('rejects restore submission when the runner is offline', async () => {
    mockIsRestoreRunnerAvailable.mockReturnValue(false);

    const response = await POST(
      new NextRequest('http://localhost/api/restore/run', {
        method: 'POST',
        body: JSON.stringify({
          timestamp: '2026-04-04T02-00-00',
          confirmationText: 'RESTORE 2026-04-04T02-00-00',
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toContain('Restore runner is not available');
  });

  it('rejects restore submission when another job is active', async () => {
    mockReadRestoreJobStatus.mockReturnValue(ACTIVE_STATUS);
    mockIsRestoreJobActive.mockReturnValue(true);

    const response = await POST(
      new NextRequest('http://localhost/api/restore/run', {
        method: 'POST',
        body: JSON.stringify({
          timestamp: '2026-04-04T02-00-00',
          confirmationText: 'RESTORE 2026-04-04T02-00-00',
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toContain('already pending or running');
  });

  it('accepts a valid full-dump restore job submission', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/restore/run', {
        method: 'POST',
        body: JSON.stringify({
          timestamp: '2026-04-04T02-00-00',
          confirmationText: 'RESTORE 2026-04-04T02-00-00',
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.success).toBe(true);
    expect(mockResolveOperatorManagedRestoreTarget).toHaveBeenCalledWith(
      '2026-04-04T02-00-00'
    );
    expect(mockWriteRestoreJobStatus).toHaveBeenCalledTimes(1);
    expect(payload.status.phase).toBe('pending');
  });

  it('accepts a valid replay-chain restore job submission', async () => {
    mockResolveOperatorManagedRestoreTarget.mockReturnValueOnce({
      scope: 'replay-chain',
      folder: '2026-04-05T02-00-00',
      manifest: {
        timestamp: '2026-04-05T02:00:00.000Z',
      },
      targetStrategy: 'differential',
      baselineFolder: '2026-04-04T02-00-00',
      dumpFileName: 'backup-2026-04-04T02-00-00.dump',
      dumpArtifactPath: '2026-04-04T02-00-00/backup-2026-04-04T02-00-00.dump',
      dumpAbsolutePath:
        '/backups/2026-04-04T02-00-00/backup-2026-04-04T02-00-00.dump',
    });
    mockBuildPendingRestoreJobStatus.mockReturnValueOnce({
      id: 'job-3',
      scope: 'replay-chain',
      phase: 'pending',
      backupFolder: '2026-04-05T02-00-00',
      baselineBackupFolder: '2026-04-04T02-00-00',
      targetStrategy: 'differential',
      dumpArtifactPath: '2026-04-04T02-00-00/backup-2026-04-04T02-00-00.dump',
      dumpFileName: 'backup-2026-04-04T02-00-00.dump',
      manifestTimestamp: '2026-04-05T02:00:00.000Z',
      requestedAt: '2026-04-05T03:10:00.000Z',
      updatedAt: '2026-04-05T03:10:00.000Z',
      message: 'Restore request accepted.',
    });

    const response = await POST(
      new NextRequest('http://localhost/api/restore/run', {
        method: 'POST',
        body: JSON.stringify({
          timestamp: '2026-04-05T02-00-00',
          confirmationText: 'RESTORE 2026-04-05T02-00-00',
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.success).toBe(true);
    expect(payload.message).toContain('backup chain is replayed');
    expect(payload.status.scope).toBe('replay-chain');
  });
});
