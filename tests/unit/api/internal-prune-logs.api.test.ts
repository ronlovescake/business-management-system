/**
 * Internal Maintenance — Prune Logs Route Tests
 *
 * Rules Covered (scheduler-and-internal-job-orchestration.md):
 *  G40: POST /api/internal/maintenance/prune-logs deletes old log entries
 *  G41: Change log retention is 90 days
 *  G42: Audit log retention is 90 days
 *  G43: Both tables are pruned in parallel
 *  G44: Response reports per-table counts and cutoff dates
 *  I52–I55: Token authentication
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockDeleteManyChangeLog = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ count: 5 })
);
const mockDeleteManyAuditLog = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ count: 3 })
);
const mockLogger = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn() }));

vi.mock('@/lib/db', () => ({
  prisma: {
    changeLog: { deleteMany: mockDeleteManyChangeLog },
    auditLog: { deleteMany: mockDeleteManyAuditLog },
  },
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Internal Route — POST /api/internal/maintenance/prune-logs', () => {
  const originalEnv = process.env.INTERNAL_JOB_TOKEN;

  beforeEach(() => {
    process.env.INTERNAL_JOB_TOKEN = 'test-prune-token';
    mockDeleteManyChangeLog.mockResolvedValue({ count: 5 });
    mockDeleteManyAuditLog.mockResolvedValue({ count: 3 });
    mockLogger.error.mockReset();
    mockLogger.info.mockReset();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.INTERNAL_JOB_TOKEN = originalEnv;
    } else {
      delete process.env.INTERNAL_JOB_TOKEN;
    }
  });

  async function importRoute() {
    vi.resetModules();
    return import('@/app/api/internal/maintenance/prune-logs/route');
  }

  function makeRequest(token?: string) {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (token) {
      headers['x-internal-token'] = token;
    }
    return new NextRequest(
      'http://localhost/api/internal/maintenance/prune-logs',
      { method: 'POST', headers, body: JSON.stringify({}) }
    );
  }

  // Token auth
  it('I53: returns 500 when INTERNAL_JOB_TOKEN is empty', async () => {
    process.env.INTERNAL_JOB_TOKEN = '';
    const mod = await importRoute();
    const response = await mod.POST(makeRequest('any-token'));
    expect(response.status).toBe(500);
  });

  it('I54: returns 401 when token is missing', async () => {
    const mod = await importRoute();
    const response = await mod.POST(makeRequest());
    expect(response.status).toBe(401);
  });

  it('I54: returns 401 when token is wrong', async () => {
    const mod = await importRoute();
    const response = await mod.POST(makeRequest('wrong-token'));
    expect(response.status).toBe(401);
  });

  // Core behavior
  it('G40: prunes both changeLog and auditLog tables', async () => {
    const mod = await importRoute();
    const response = await mod.POST(makeRequest('test-prune-token'));
    expect(response.status).toBe(200);
    expect(mockDeleteManyChangeLog).toHaveBeenCalledOnce();
    expect(mockDeleteManyAuditLog).toHaveBeenCalledOnce();
  });

  it('G41–G42: uses 90-day retention for both tables', async () => {
    const mod = await importRoute();
    await mod.POST(makeRequest('test-prune-token'));

    // Verify the cutoff date is approximately 90 days ago
    const changeLogCall = mockDeleteManyChangeLog.mock.calls[0]?.[0];
    const auditLogCall = mockDeleteManyAuditLog.mock.calls[0]?.[0];

    expect(changeLogCall).toBeDefined();
    expect(auditLogCall).toBeDefined();

    const changeLogCutoff = new Date(changeLogCall.where.createdAt.lt);
    const auditLogCutoff = new Date(auditLogCall.where.timestamp.lt);

    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Allow 5 seconds tolerance for test execution time
    const tolerance = 5000;
    expect(
      Math.abs(changeLogCutoff.getTime() - ninetyDaysAgo.getTime())
    ).toBeLessThan(tolerance);
    expect(
      Math.abs(auditLogCutoff.getTime() - ninetyDaysAgo.getTime())
    ).toBeLessThan(tolerance);
  });

  it('G44: response includes per-table counts, retention, and cutoffs', async () => {
    const mod = await importRoute();
    const response = await mod.POST(makeRequest('test-prune-token'));
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.changeLog).toMatchObject({
      pruned: 5,
      retentionDays: 90,
    });
    expect(body.changeLog.cutoff).toBeDefined();
    expect(body.auditLog).toMatchObject({
      pruned: 3,
      retentionDays: 90,
    });
    expect(body.auditLog.cutoff).toBeDefined();
  });

  it('G40: returns 500 if pruning fails', async () => {
    mockDeleteManyChangeLog.mockRejectedValue(new Error('DB connection lost'));
    const mod = await importRoute();
    const response = await mod.POST(makeRequest('test-prune-token'));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('DB connection lost');
  });
});
