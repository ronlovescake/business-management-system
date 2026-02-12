import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRequireAdmin } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  requireAdmin: mockRequireAdmin,
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    $disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/env', () => ({
  getDatabaseUrl: vi
    .fn()
    .mockReturnValue('postgresql://user:pass@localhost:5432/test_db'),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { POST as backupPost } from '@/app/api/backup/route';
import { POST as restorePost } from '@/app/api/restore/route';
import { GET as backupFileGet } from '@/app/api/backup/[timestamp]/[filename]/route';

describe('Backup/Restore security hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for restore when unauthenticated', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('Unauthorized'));

    const response = await restorePost(
      new NextRequest('http://localhost/api/restore', {
        method: 'POST',
        body: JSON.stringify({
          timestamp: '2026-02-11T10-10-10',
          file: 'backup-2026-02-11T10-10-10.json',
        }),
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(401);
    expect(payload.error).toContain('Authentication required');
  });

  it('returns 403 for backup create when admin check fails', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('Forbidden'));

    const response = await backupPost(
      new NextRequest('http://localhost/api/backup', {
        method: 'POST',
        body: JSON.stringify({ format: 'json' }),
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(403);
    expect(payload.error).toContain('Admin access required');
  });

  it('returns 401 for backup file access when unauthenticated', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('Unauthorized'));

    const response = await backupFileGet(
      new NextRequest(
        'http://localhost/api/backup/2026-02-11T10-10-10/backup-2026-02-11T10-10-10.json'
      ),
      {
        params: {
          timestamp: '2026-02-11T10-10-10',
          filename: 'backup-2026-02-11T10-10-10.json',
        },
      }
    );

    const payload = await response.json();
    expect(response.status).toBe(401);
    expect(payload.error).toContain('Authentication required');
  });
});
