import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRequireAdmin, mockExistsSync, mockPlanRestoreChain } = vi.hoisted(
  () => ({
    mockRequireAdmin: vi.fn().mockResolvedValue(undefined),
    mockExistsSync: vi.fn(),
    mockPlanRestoreChain: vi.fn(),
  })
);

vi.mock('@/lib/auth/session', () => ({
  requireAdmin: mockRequireAdmin,
}));

vi.mock('fs', () => ({
  __esModule: true,
  default: {
    existsSync: mockExistsSync,
  },
  existsSync: mockExistsSync,
}));

vi.mock('@/lib/backup/restorePlanner', () => ({
  planRestoreChain: mockPlanRestoreChain,
}));

vi.mock('@/lib/backup-storage', () => ({
  getBackupDirectory: () => '/tmp/backups',
}));

import { GET } from '@/app/api/backup/[timestamp]/plan/route';

describe('Backup restore plan API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockPlanRestoreChain.mockReturnValue({
      status: 'ready',
      targetFolder: '2026-04-04T02-00-00',
      targetTimestamp: '2026-04-04T02:00:00.000Z',
      targetStrategy: 'full',
      chainFolders: ['2026-04-04T02-00-00'],
      steps: [],
      warnings: [],
      errors: [],
      requiresReplayEngine: false,
      disasterRecoveryReady: true,
    });
  });

  it('returns 401 when authentication fails', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('Unauthorized'));

    const response = await GET(
      new NextRequest('http://localhost/api/backup/2026-04-04T02-00-00/plan'),
      { params: { timestamp: '2026-04-04T02-00-00' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toContain('Authentication required');
  });

  it('returns 400 for invalid timestamp folders', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/backup/invalid/plan'),
      { params: { timestamp: '../invalid' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid timestamp format');
  });

  it('returns 404 when the backup folder does not exist', async () => {
    mockExistsSync.mockReturnValue(false);

    const response = await GET(
      new NextRequest('http://localhost/api/backup/2026-04-04T02-00-00/plan'),
      { params: { timestamp: '2026-04-04T02-00-00' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe('Backup not found');
  });

  it('returns a restore plan for a valid backup folder', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/backup/2026-04-04T02-00-00/plan'),
      { params: { timestamp: '2026-04-04T02-00-00' } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.plan.status).toBe('ready');
    expect(mockPlanRestoreChain).toHaveBeenCalledWith({
      folder: '2026-04-04T02-00-00',
    });
  });
});
