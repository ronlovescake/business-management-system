import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  mockRequireBackupRestoreAdmin,
  mockQueryChangeLogs,
  mockGetDistinctChangeLogFilters,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockRequireBackupRestoreAdmin: vi.fn().mockResolvedValue(null),
  mockQueryChangeLogs: vi.fn(),
  mockGetDistinctChangeLogFilters: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('@/app/api/backup-restore/sharedRouteUtils', () => ({
  requireBackupRestoreAdmin: mockRequireBackupRestoreAdmin,
}));

vi.mock('@/core/change-log', () => ({
  queryChangeLogs: mockQueryChangeLogs,
  getDistinctChangeLogFilters: mockGetDistinctChangeLogFilters,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: mockLoggerError,
  },
}));

import { GET } from '@/app/api/backup/pitr/investigate/route';

describe('Backup PITR investigate API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockQueryChangeLogs.mockResolvedValue({
      data: [
        {
          id: 'log-1',
          createdAt: '2026-04-04T12:00:00.000Z',
          userId: 'user-1',
          userName: 'Ron',
          entityType: 'Transaction',
          entityId: 'txn-1',
          action: 'delete',
          field: null,
          oldValue: null,
          newValue: null,
          source: 'transactions',
          metadata: { invoiceNumber: 'INV-1001' },
        },
      ],
      total: 1,
      page: 2,
      limit: 200,
    });
    mockGetDistinctChangeLogFilters.mockResolvedValue({
      entityTypes: ['Transaction'],
      actions: ['delete'],
      sources: ['transactions'],
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
      new NextRequest('http://localhost/api/backup/pitr/investigate')
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toContain('Authentication required');
  });

  it('forwards actor and business identifier filters to the change-log query', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/api/backup/pitr/investigate?page=2&limit=500&actor=Ron&search=INV-1001&entityType=Transaction&entityId=txn-1&action=delete&source=transactions&startDate=2026-04-04T00:00:00.000Z&endDate=2026-04-04T23:59:59.000Z'
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockQueryChangeLogs).toHaveBeenCalledWith({
      page: 2,
      limit: 200,
      entityType: 'Transaction',
      entityId: 'txn-1',
      userId: undefined,
      actor: 'Ron',
      action: 'delete',
      source: 'transactions',
      search: 'INV-1001',
      startDate: new Date('2026-04-04T00:00:00.000Z'),
      endDate: new Date('2026-04-04T23:59:59.000Z'),
    });
    expect(payload.pagination).toEqual({
      page: 2,
      limit: 200,
      total: 1,
      pages: 1,
    });
    expect(payload.filters).toEqual({
      entityTypes: ['Transaction'],
      actions: ['delete'],
      sources: ['transactions'],
    });
  });
});