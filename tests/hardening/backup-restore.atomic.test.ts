import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRequireAdmin, mockPrisma } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn().mockResolvedValue(undefined),
  mockPrisma: {
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/auth/session', () => ({
  requireAdmin: mockRequireAdmin,
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { POST as restorePost } from '@/app/api/restore/route';

describe('Backup/Restore atomic hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects mutating restore requests before any transaction work begins', async () => {
    const response = await restorePost(
      new NextRequest('http://localhost/api/restore', {
        method: 'POST',
        body: JSON.stringify({
          timestamp: '2026-02-11T10-10-10',
          file: 'backup-2026-02-11T10-10-10.json',
          tables: ['customers', 'transactions'],
          forceOverwrite: true,
          stopOnError: true,
        }),
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe('RESTORE_RETIRED');
    expect(payload.error).toContain('docker:restore:docker-db');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns the same retired response even when multiple restore attempts arrive', async () => {
    const firstResponse = await restorePost(
      new NextRequest('http://localhost/api/restore', {
        method: 'POST',
        body: JSON.stringify({
          timestamp: '2026-02-11T10-10-10',
          file: 'backup-2026-02-11T10-10-10.json',
          tables: ['customers'],
          forceOverwrite: true,
          stopOnError: true,
        }),
      })
    );
    const firstPayload = await firstResponse.json();

    const secondResponse = await restorePost(
      new NextRequest('http://localhost/api/restore', {
        method: 'POST',
        body: JSON.stringify({
          timestamp: '2026-02-11T10-10-10',
          file: 'backup-2026-02-11T10-10-10.json',
          tables: ['customers'],
          forceOverwrite: true,
          stopOnError: true,
        }),
      })
    );
    const secondPayload = await secondResponse.json();

    expect(firstResponse.status).toBe(410);
    expect(firstPayload.code).toBe('RESTORE_RETIRED');
    expect(secondResponse.status).toBe(410);
    expect(secondPayload.code).toBe('RESTORE_RETIRED');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
