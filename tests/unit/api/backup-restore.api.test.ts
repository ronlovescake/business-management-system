import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRequireAdmin } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth/session', () => ({
  requireAdmin: mockRequireAdmin,
}));

import { POST } from '@/app/api/restore/route';

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const buildRequest = (body: unknown, init?: NextRequestInit) =>
  new NextRequest('http://localhost/api/restore', {
    method: 'POST',
    body: JSON.stringify(body),
    ...init,
  });

describe('Restore API hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 410 because browser restore is retired', async () => {
    const response = await POST(
      buildRequest({
        timestamp: '2026-02-11T10-10-10',
        file: 'backup.json',
        tables: ['transactions'],
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe('RESTORE_RETIRED');
    expect(payload.error).toContain('docker:restore:docker-db');
  });

  it('returns 401 when restore is requested without authentication', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('Unauthorized'));

    const response = await POST(
      buildRequest({
        timestamp: '2026-02-11T10-10-10',
        file: 'backup.json',
        tables: ['transactions'],
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toContain('Authentication required');
  });
});
