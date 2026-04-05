import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  mockRequireBackupRestoreAdmin,
  mockQueryAuditLogs,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockRequireBackupRestoreAdmin: vi.fn().mockResolvedValue(null),
  mockQueryAuditLogs: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('@/app/api/backup-restore/sharedRouteUtils', () => ({
  requireBackupRestoreAdmin: mockRequireBackupRestoreAdmin,
}));

vi.mock('@/core/audit-log', () => ({
  queryAuditLogs: mockQueryAuditLogs,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: mockLoggerError,
  },
}));

import { GET } from '@/app/api/backup/pitr/audit/route';

describe('Backup PITR audit API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryAuditLogs.mockResolvedValue([
      {
        id: 'audit-1',
        model: 'Transaction',
        action: 'update',
        targetId: '2417',
        before: { quantity: 100 },
        after: { quantity: 1000 },
        timestamp: '2026-04-04T12:00:00.000Z',
      },
    ]);
  });

  it('returns auth failures from the admin guard', async () => {
    mockRequireBackupRestoreAdmin.mockResolvedValueOnce(
      NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    );

    const response = await GET(
      new NextRequest('http://localhost/api/backup/pitr/audit')
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toContain('Authentication required');
  });

  it('forwards the selected event identity to the audit-log query', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/api/backup/pitr/audit?entityType=transaction&entityId=2417&action=update&eventTime=2026-04-04T12:00:00.000Z&limit=50'
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockQueryAuditLogs).toHaveBeenCalledWith({
      entityType: 'transaction',
      entityId: '2417',
      action: 'update',
      eventTime: new Date('2026-04-04T12:00:00.000Z'),
      limit: 25,
    });
    expect(payload.logs).toHaveLength(1);
  });
});