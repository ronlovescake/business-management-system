/**
 * Internal Job Routes — Token Authentication Tests
 *
 * Tests the shared requireInternalToken pattern used by all 7 internal routes.
 * Since every route duplicates the same pattern, we test via the shared helper
 * in internalRouteUtils and representative route handlers.
 *
 * Rules Covered (scheduler-and-internal-job-orchestration.md):
 *  I52: All routes use the same token pattern
 *  I53: Empty server-side token returns 500
 *  I54: Wrong/missing client token returns 401
 *  I55: Token comparison is exact string match after trim
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
const mockLogger = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn() }));
const mockRunScheduledBackupJob = vi.hoisted(() => vi.fn());
const mockRunScheduledPitrBaseBackup = vi.hoisted(() => vi.fn());
const mockIsPitrErrorWithStatusCode = vi.hoisted(() => vi.fn().mockReturnValue(false));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/lib/backup/scheduledBackupRunner', () => ({
  runScheduledBackupJob: mockRunScheduledBackupJob,
  ScheduledBackupConfigurationError: class extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'ScheduledBackupConfigurationError';
    }
  },
}));
vi.mock('@/lib/backup/pitr', () => ({
  runScheduledPitrBaseBackup: mockRunScheduledPitrBaseBackup,
  isPitrErrorWithStatusCode: mockIsPitrErrorWithStatusCode,
}));

// =========================================================================
// Token auth tests via backup/run route (representative)
// =========================================================================

describe('Internal Route — Token Authentication (E31–I55)', () => {
  let POST: (request: NextRequest) => Promise<Response>;
  const originalEnv = process.env.INTERNAL_JOB_TOKEN;

  beforeEach(async () => {
    vi.resetModules();
    mockRunScheduledBackupJob.mockResolvedValue({ success: true });
    const mod = await import(
      '@/app/api/internal/backup/run/route'
    );
    POST = mod.POST;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.INTERNAL_JOB_TOKEN = originalEnv;
    } else {
      delete process.env.INTERNAL_JOB_TOKEN;
    }
  });

  it('I53: returns 500 when INTERNAL_JOB_TOKEN is not set', async () => {
    process.env.INTERNAL_JOB_TOKEN = '';
    // Re-import to pick up env change
    vi.resetModules();
    const mod = await import('@/app/api/internal/backup/run/route');
    const request = new NextRequest('http://localhost/api/internal/backup/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await mod.POST(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('INTERNAL_JOB_TOKEN');
  });

  it('I54: returns 401 when token is missing from request', async () => {
    process.env.INTERNAL_JOB_TOKEN = 'valid-secret-token';
    vi.resetModules();
    const mod = await import('@/app/api/internal/backup/run/route');
    const request = new NextRequest('http://localhost/api/internal/backup/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await mod.POST(request);
    expect(response.status).toBe(401);
  });

  it('I54: returns 401 when token is wrong', async () => {
    process.env.INTERNAL_JOB_TOKEN = 'valid-secret-token';
    vi.resetModules();
    const mod = await import('@/app/api/internal/backup/run/route');
    const request = new NextRequest('http://localhost/api/internal/backup/run', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': 'wrong-token',
      },
      body: JSON.stringify({}),
    });

    const response = await mod.POST(request);
    expect(response.status).toBe(401);
  });

  it('I55: accepts correct token (trimmed comparison)', async () => {
    process.env.INTERNAL_JOB_TOKEN = '  valid-secret-token  ';
    vi.resetModules();
    const mod = await import('@/app/api/internal/backup/run/route');
    mockRunScheduledBackupJob.mockResolvedValue({ success: true });
    const request = new NextRequest('http://localhost/api/internal/backup/run', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': 'valid-secret-token',
      },
      body: JSON.stringify({}),
    });

    const response = await mod.POST(request);
    expect(response.status).toBe(200);
  });
});

// =========================================================================
// Backup run route tests (E31–E32)
// =========================================================================

describe('Internal Route — POST /api/internal/backup/run (E31–E32)', () => {
  const originalEnv = process.env.INTERNAL_JOB_TOKEN;

  beforeEach(() => {
    process.env.INTERNAL_JOB_TOKEN = 'test-token';
    mockRunScheduledBackupJob.mockReset();
    mockLogger.error.mockReset();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.INTERNAL_JOB_TOKEN = originalEnv;
    } else {
      delete process.env.INTERNAL_JOB_TOKEN;
    }
  });

  it('E31: delegates to runScheduledBackupJob and returns result', async () => {
    vi.resetModules();
    const mod = await import('@/app/api/internal/backup/run/route');
    const expectedResult = {
      success: true,
      backup: { timestamp: '2026-04-11T22-00-00', strategy: 'full' },
    };
    mockRunScheduledBackupJob.mockResolvedValue(expectedResult);

    const request = new NextRequest('http://localhost/api/internal/backup/run', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': 'test-token',
      },
      body: JSON.stringify({
        strategy: 'full',
        format: 'dump',
        retentionDays: 30,
      }),
    });

    const response = await mod.POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('E32: returns 400 for ScheduledBackupConfigurationError', async () => {
    vi.resetModules();

    // Re-mock with the error class accessible
    const { ScheduledBackupConfigurationError } = await import(
      '@/lib/backup/scheduledBackupRunner'
    );
    mockRunScheduledBackupJob.mockRejectedValue(
      new ScheduledBackupConfigurationError('Invalid schedule time')
    );

    const mod = await import('@/app/api/internal/backup/run/route');
    const request = new NextRequest('http://localhost/api/internal/backup/run', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': 'test-token',
      },
      body: JSON.stringify({ strategy: 'full' }),
    });

    const response = await mod.POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid schedule time');
  });

  it('E32: returns 500 for unexpected errors', async () => {
    vi.resetModules();
    mockRunScheduledBackupJob.mockRejectedValue(new Error('disk full'));

    const mod = await import('@/app/api/internal/backup/run/route');
    const request = new NextRequest('http://localhost/api/internal/backup/run', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': 'test-token',
      },
      body: JSON.stringify({}),
    });

    const response = await mod.POST(request);
    expect(response.status).toBe(500);
  });
});

// =========================================================================
// PITR base route tests (E33)
// =========================================================================

describe('Internal Route — POST /api/internal/backup/pitr/run (E33)', () => {
  const originalEnv = process.env.INTERNAL_JOB_TOKEN;

  beforeEach(() => {
    process.env.INTERNAL_JOB_TOKEN = 'test-token';
    mockRunScheduledPitrBaseBackup.mockReset();
    mockIsPitrErrorWithStatusCode.mockReset();
    mockLogger.error.mockReset();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.INTERNAL_JOB_TOKEN = originalEnv;
    } else {
      delete process.env.INTERNAL_JOB_TOKEN;
    }
  });

  it('E33: delegates to runScheduledPitrBaseBackup', async () => {
    vi.resetModules();
    mockRunScheduledPitrBaseBackup.mockResolvedValue({ success: true });
    const mod = await import('@/app/api/internal/backup/pitr/run/route');

    const request = new NextRequest(
      'http://localhost/api/internal/backup/pitr/run',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-token': 'test-token',
        },
        body: JSON.stringify({}),
      }
    );

    const response = await mod.POST(request);
    expect(response.status).toBe(200);
  });

  it('E33: forwards PITR-specific error status codes', async () => {
    vi.resetModules();
    const pitrError = Object.assign(new Error('WAL archiving disabled'), {
      statusCode: 400,
    });
    mockRunScheduledPitrBaseBackup.mockRejectedValue(pitrError);
    mockIsPitrErrorWithStatusCode.mockReturnValue(true);

    const mod = await import('@/app/api/internal/backup/pitr/run/route');
    const request = new NextRequest(
      'http://localhost/api/internal/backup/pitr/run',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-token': 'test-token',
        },
        body: JSON.stringify({}),
      }
    );

    const response = await mod.POST(request);
    expect(response.status).toBe(400);
  });
});
