import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRequireAdmin } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth/session', () => ({
  requireAdmin: mockRequireAdmin,
}));

import { POST as restorePost } from '@/app/api/restore/route';

describe('Backup/Restore integrity hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses API restore and points operators to the dump restore workflow', async () => {
    const response = await restorePost(
      new NextRequest('http://localhost/api/restore', {
        method: 'POST',
        body: JSON.stringify({
          timestamp: '2026-02-11T10-10-10',
          file: 'backup-2026-02-11T10-10-10.json',
          tables: ['transactions'],
        }),
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe('RESTORE_RETIRED');
    expect(payload.error).toContain('docker:restore:docker-db');
  });
});
