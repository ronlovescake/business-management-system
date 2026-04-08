/**
 * Change-Log & Version-History API (Business Rule Tests)
 *
 * Rules from docs/business-logic/platform/change-log-and-version-history.md:
 *   #1  — Old /api/change-log returns 410 Gone
 *   #8  — Auth required for settings change-log
 *   #9  — Supports broad operator filtering
 *   #10 — Default page size 25, max 200
 *   #11 — includeFilters toggle controls distinct filter response
 *   #14 — Version-history GET returns empty array
 *   #16 — Sync accepts dataKey + versions array
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---- hoisted mocks ----

const {
  mockGetCurrentUser,
  mockQueryChangeLogs,
  mockGetDistinctChangeLogFilters,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockQueryChangeLogs: vi.fn(),
  mockGetDistinctChangeLogFilters: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/core/change-log', () => ({
  queryChangeLogs: mockQueryChangeLogs,
  getDistinctChangeLogFilters: mockGetDistinctChangeLogFilters,
}));

vi.mock('@/core/api/middleware', () => ({
  withErrorHandler: (fn: Function) => fn,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/security/sanitize', () => ({
  sanitizers: { name: (v: string) => v.trim() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// =========================================================================
// Rule #1: /api/change-log returns 410 Gone
// =========================================================================

describe('Rule #1: Old /api/change-log returns 410 Gone', () => {
  it('returns 410 status', async () => {
    const { GET } = await import('@/app/api/change-log/route');
    const res = await GET();

    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});

// =========================================================================
// Rule #8: Auth required for settings change-log
// =========================================================================

describe('Rule #8: Settings change-log requires authentication', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { GET } = await import(
      '@/app/api/clothing/operations/settings/change-log/route'
    );
    const req = new NextRequest(
      'http://localhost/api/clothing/operations/settings/change-log'
    );
    const res = await GET(req);

    expect(res.status).toBe(401);
  });
});

// =========================================================================
// Rule #10: Default page size 25, max 200
// =========================================================================

describe('Rule #10: Page size defaults and max', () => {
  it('defaults to limit 25', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockQueryChangeLogs.mockResolvedValue({
      data: [],
      page: 1,
      limit: 25,
      total: 0,
    });
    mockGetDistinctChangeLogFilters.mockResolvedValue({});

    const { GET } = await import(
      '@/app/api/clothing/operations/settings/change-log/route'
    );
    const req = new NextRequest(
      'http://localhost/api/clothing/operations/settings/change-log'
    );
    await GET(req);

    const call = mockQueryChangeLogs.mock.calls[0][0];
    expect(call.limit).toBe(25);
  });

  it('clamps limit to max 200', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockQueryChangeLogs.mockResolvedValue({
      data: [],
      page: 1,
      limit: 200,
      total: 0,
    });
    mockGetDistinctChangeLogFilters.mockResolvedValue({});

    const { GET } = await import(
      '@/app/api/clothing/operations/settings/change-log/route'
    );
    const req = new NextRequest(
      'http://localhost/api/clothing/operations/settings/change-log?limit=500'
    );
    await GET(req);

    const call = mockQueryChangeLogs.mock.calls[0][0];
    expect(call.limit).toBe(200);
  });
});

// =========================================================================
// Rule #9: Broad operator filtering  
// =========================================================================

describe('Rule #9: Supports broad filtering params', () => {
  it('passes all filter params to queryChangeLogs', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockQueryChangeLogs.mockResolvedValue({
      data: [],
      page: 1,
      limit: 25,
      total: 0,
    });
    mockGetDistinctChangeLogFilters.mockResolvedValue({});

    const { GET } = await import(
      '@/app/api/clothing/operations/settings/change-log/route'
    );
    const params = new URLSearchParams({
      page: '2',
      limit: '50',
      entityType: 'Employee',
      entityId: 'emp-1',
      userId: 'user-2',
      action: 'update',
      source: 'admin',
      search: 'salary',
      startDate: '2026-01-01',
      endDate: '2026-04-08',
    });
    const req = new NextRequest(
      `http://localhost/api/clothing/operations/settings/change-log?${params}`
    );
    await GET(req);

    const call = mockQueryChangeLogs.mock.calls[0][0];
    expect(call.page).toBe(2);
    expect(call.limit).toBe(50);
    expect(call.entityType).toBe('Employee');
    expect(call.entityId).toBe('emp-1');
    expect(call.userId).toBe('user-2');
    expect(call.action).toBe('update');
    expect(call.source).toBe('admin');
    expect(call.search).toBe('salary');
    expect(call.startDate).toEqual(new Date('2026-01-01'));
    expect(call.endDate).toEqual(new Date('2026-04-08'));
  });
});

// =========================================================================
// Rule #11: includeFilters toggle
// =========================================================================

describe('Rule #11: includeFilters controls distinct filter response', () => {
  it('calls getDistinctChangeLogFilters when includeFilters is true (default)', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockQueryChangeLogs.mockResolvedValue({
      data: [],
      page: 1,
      limit: 25,
      total: 0,
    });
    mockGetDistinctChangeLogFilters.mockResolvedValue({
      entityTypes: ['Employee'],
    });

    const { GET } = await import(
      '@/app/api/clothing/operations/settings/change-log/route'
    );
    const req = new NextRequest(
      'http://localhost/api/clothing/operations/settings/change-log'
    );
    await GET(req);

    expect(mockGetDistinctChangeLogFilters).toHaveBeenCalled();
  });

  it('skips getDistinctChangeLogFilters when includeFilters=false', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockQueryChangeLogs.mockResolvedValue({
      data: [],
      page: 1,
      limit: 25,
      total: 0,
    });

    const { GET } = await import(
      '@/app/api/clothing/operations/settings/change-log/route'
    );
    const req = new NextRequest(
      'http://localhost/api/clothing/operations/settings/change-log?includeFilters=false'
    );
    await GET(req);

    expect(mockGetDistinctChangeLogFilters).not.toHaveBeenCalled();
  });
});

// =========================================================================  
// Rule #14: Version-history GET returns empty array
// =========================================================================

describe('Rule #14: Version-history GET returns empty array', () => {
  it('returns [] with valid dataKey', async () => {
    const { GET } = await import('@/app/api/version-history/route');
    const req = new NextRequest(
      'http://localhost/api/version-history?dataKey=employees'
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual([]);
  });

  it('returns 400 without dataKey', async () => {
    const { GET } = await import('@/app/api/version-history/route');
    const req = new NextRequest('http://localhost/api/version-history');
    const res = await GET(req);

    expect(res.status).toBe(400);
  });
});

// =========================================================================
// Rule #16: Sync accepts dataKey + versions array
// =========================================================================

describe('Rule #16: Version-history sync payload', () => {
  it('accepts valid sync payload', async () => {
    const { POST } = await import('@/app/api/version-history/sync/route');
    const req = new NextRequest('http://localhost/api/version-history/sync', {
      method: 'POST',
      body: JSON.stringify({
        dataKey: 'employees',
        versions: [{ id: 'v1', data: {}, timestamp: Date.now() }],
        timestamp: Date.now(),
      }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('rejects when dataKey missing', async () => {
    const { POST } = await import('@/app/api/version-history/sync/route');
    const req = new NextRequest('http://localhost/api/version-history/sync', {
      method: 'POST',
      body: JSON.stringify({
        versions: [{ id: 'v1' }],
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('rejects when versions is not an array', async () => {
    const { POST } = await import('@/app/api/version-history/sync/route');
    const req = new NextRequest('http://localhost/api/version-history/sync', {
      method: 'POST',
      body: JSON.stringify({
        dataKey: 'employees',
        versions: 'not-an-array',
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});
