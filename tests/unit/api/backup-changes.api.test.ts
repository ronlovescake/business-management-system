import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  mockRequireBackupRestoreAdmin,
  mockExistsSync,
  mockReadManifest,
  mockCollectRestoreVerificationSnapshot,
} = vi.hoisted(() => ({
  mockRequireBackupRestoreAdmin: vi.fn().mockResolvedValue(null),
  mockExistsSync: vi.fn(),
  mockReadManifest: vi.fn(),
  mockCollectRestoreVerificationSnapshot: vi.fn(),
}));

vi.mock('fs', () => ({
  __esModule: true,
  default: {
    existsSync: mockExistsSync,
  },
  existsSync: mockExistsSync,
}));

vi.mock('@/app/api/backup-restore/sharedRouteUtils', () => ({
  isValidTimestampFolderName: vi.fn().mockReturnValue(true),
  requireBackupRestoreAdmin: mockRequireBackupRestoreAdmin,
}));

vi.mock('@/lib/backup-storage', () => ({
  getBackupDirectory: () => '/tmp/backups',
}));

vi.mock('@/app/api/backup/backupRouteUtils', () => ({
  readManifest: mockReadManifest,
}));

vi.mock('@/lib/backup/restoreVerification', async () => {
  const actual = await vi.importActual('@/lib/backup/restoreVerification');

  return {
    ...actual,
    collectRestoreVerificationSnapshot: mockCollectRestoreVerificationSnapshot,
  };
});

import { GET } from '@/app/api/backup/[timestamp]/changes/route';

describe('Backup changes API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockExistsSync.mockReturnValue(true);
    mockReadManifest.mockReturnValue({
      timestamp: '2026-04-04T04:46:07.000Z',
      strategy: 'full',
      recordCounts: {
        transactions: 10,
        customers: 4,
      },
    });
    mockCollectRestoreVerificationSnapshot.mockResolvedValue({
      generatedAt: '2026-04-04T06:00:00.000Z',
      entries: [
        {
          key: 'transactions',
          modelName: 'Transaction',
          schema: 'public',
          table: 'Transaction',
          coverage: 'selective-json',
          count: 12,
        },
        {
          key: 'customers',
          modelName: 'Customer',
          schema: 'public',
          table: 'Customer',
          coverage: 'selective-json',
          count: 4,
        },
      ],
    });
  });

  it('returns auth failures from the admin guard', async () => {
    mockRequireBackupRestoreAdmin.mockResolvedValueOnce(
      NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    );

    const response = await GET(
      new NextRequest(
        'http://localhost/api/backup/2026-04-04T04-46-07/changes'
      ),
      { params: { timestamp: '2026-04-04T04-46-07' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toContain('Authentication required');
  });

  it('returns 404 when the backup folder does not exist', async () => {
    mockExistsSync.mockReturnValue(false);

    const response = await GET(
      new NextRequest(
        'http://localhost/api/backup/2026-04-04T04-46-07/changes'
      ),
      { params: { timestamp: '2026-04-04T04-46-07' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe('Backup not found');
  });

  it('returns 409 for non-full backups', async () => {
    mockReadManifest.mockReturnValueOnce({
      timestamp: '2026-04-04T04:46:07.000Z',
      strategy: 'differential',
      recordCounts: { transactions: 10 },
    });

    const response = await GET(
      new NextRequest(
        'http://localhost/api/backup/2026-04-04T04-46-07/changes'
      ),
      { params: { timestamp: '2026-04-04T04-46-07' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toContain('available only for full backups');
  });

  it('returns a live-vs-backup change summary for full backups', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/api/backup/2026-04-04T04-46-07/changes'
      ),
      { params: { timestamp: '2026-04-04T04-46-07' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.comparison.backupTimestamp).toBe('2026-04-04T04-46-07');
    expect(payload.comparison.changedTables).toBe(1);
    expect(payload.comparison.entries).toEqual([
      expect.objectContaining({
        key: 'transactions',
        status: 'increased',
        delta: 2,
      }),
      expect.objectContaining({
        key: 'customers',
        status: 'unchanged',
        delta: 0,
      }),
    ]);
  });
});
