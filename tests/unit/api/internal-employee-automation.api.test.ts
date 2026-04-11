/**
 * Internal Employee Automation Routes — Business-Rule-Mapped Tests
 *
 * Tests the three domain-specific internal automation routes and
 * the shared internalRouteUtils helpers.
 *
 * Rules Covered (scheduler-and-internal-job-orchestration.md):
 *  F34: Three parallel routes for clothing, GM, trucking
 *  F35: Each loads domain-specific settings then calls executeDueAutomations
 *  F36: Results are selectively persisted (shouldPersistScheduledRun)
 *  F37: Persisted runs write a change-log entry
 *  F38: Success is true only if no result has status 'error'
 *  F39: Response includes summary counts
 *  I52–I55: Token authentication
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks — shared across all route variants
// ---------------------------------------------------------------------------
const mockLogger = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn() }));
const mockRecordChange = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockExecuteDueAutomations = vi.hoisted(() => vi.fn());

// Clothing-specific mocks
const mockGetClothingSettings = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockCreateClothingRun = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: 1 })
);

// GM-specific mocks
const mockGetGMSettings = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockCreateGMRun = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: 2 })
);

// Trucking-specific mocks
const mockGetTruckingSettings = vi.hoisted(() =>
  vi.fn().mockResolvedValue({})
);
const mockCreateTruckingRun = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: 3 })
);

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/core/change-log', () => ({ recordChange: mockRecordChange }));
vi.mock('@/modules/shared/employees/automation', () => ({
  executeDueAutomations: mockExecuteDueAutomations,
}));

vi.mock('@/lib/settings/employeeAutomation', () => ({
  createEmployeeAutomationRun: mockCreateClothingRun,
  getEmployeeAutomationSettings: mockGetClothingSettings,
}));

vi.mock('@/lib/settings/generalMerchandiseEmployeeAutomation', () => ({
  createGeneralMerchandiseEmployeeAutomationRun: mockCreateGMRun,
  getGeneralMerchandiseEmployeeAutomationSettings: mockGetGMSettings,
}));

vi.mock('@/lib/settings/truckingEmployeeAutomation', () => ({
  createTruckingEmployeeAutomationRun: mockCreateTruckingRun,
  getTruckingEmployeeAutomationSettings: mockGetTruckingSettings,
}));

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string, token?: string) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (token) {
    headers['x-internal-token'] = token;
  }
  return new NextRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
}

function makeSuccessResult(automationType: string) {
  return {
    automationType,
    status: 'success',
    message: 'Automation executed',
    periodKey: '2026-04-11T14:30',
    metadata: {},
  };
}

function makeSkippedResult(
  automationType: string,
  skipReason: string = 'disabled'
) {
  return {
    automationType,
    status: 'skipped',
    message: 'Skipped',
    periodKey: null,
    metadata: { skipReason },
  };
}

function makeErrorResult(automationType: string) {
  return {
    automationType,
    status: 'error',
    message: 'Something failed',
    periodKey: null,
    metadata: {},
  };
}

// ===========================================================================
// Tests for shouldPersistScheduledRun (F36)
// ===========================================================================

describe('internalRouteUtils — shouldPersistScheduledRun (F36)', () => {
  let shouldPersistScheduledRun: Function;
  let summarizeScheduledResults: Function;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import(
      '@/modules/shared/employees/automation/internalRouteUtils'
    );
    shouldPersistScheduledRun = mod.shouldPersistScheduledRun;
    summarizeScheduledResults = mod.summarizeScheduledResults;
  });

  it('F36: returns false for disabled skip reason', () => {
    expect(
      shouldPersistScheduledRun(makeSkippedResult('stayIn', 'disabled'))
    ).toBe(false);
  });

  it('F36: returns false for already-recorded-run skip reason', () => {
    expect(
      shouldPersistScheduledRun(
        makeSkippedResult('stayIn', 'already-recorded-run')
      )
    ).toBe(false);
  });

  it('F36: returns false for no-due-cutoff skip reason', () => {
    expect(
      shouldPersistScheduledRun(
        makeSkippedResult('stayIn', 'no-due-cutoff')
      )
    ).toBe(false);
  });

  it('F36: returns true for success results', () => {
    expect(shouldPersistScheduledRun(makeSuccessResult('stayIn'))).toBe(true);
  });

  it('F36: returns true for error results', () => {
    expect(shouldPersistScheduledRun(makeErrorResult('stayIn'))).toBe(true);
  });

  it('F36: returns true for skipped with other skip reasons', () => {
    const result = makeSkippedResult('stayIn', 'time-not-reached');
    expect(shouldPersistScheduledRun(result)).toBe(true);
  });

  // F39: summarizeScheduledResults
  it('F39: counts executed, succeeded, skipped, failed correctly', () => {
    const results = [
      makeSuccessResult('stayIn'),
      makeSkippedResult('payroll', 'disabled'),
      makeErrorResult('attendance'),
      makeSkippedResult('leave', 'time-not-reached'),
    ];

    const summary = summarizeScheduledResults(results);
    // 'disabled' is not persisted, so executed = 3
    expect(summary.executed).toBe(3);
    expect(summary.succeeded).toBe(1);
    expect(summary.skipped).toBe(2);
    expect(summary.failed).toBe(1);
  });
});

// ===========================================================================
// Route tests for each domain (F34–F38)
// ===========================================================================

describe.each([
  {
    domain: 'clothing',
    path: '/api/internal/employee-automation/run-due',
    importPath: '@/app/api/internal/employee-automation/run-due/route',
  },
  {
    domain: 'general-merchandise',
    path: '/api/internal/general-merchandise/employee-automation/run-due',
    importPath:
      '@/app/api/internal/general-merchandise/employee-automation/run-due/route',
  },
  {
    domain: 'trucking',
    path: '/api/internal/trucking/employee-automation/run-due',
    importPath:
      '@/app/api/internal/trucking/employee-automation/run-due/route',
  },
])(
  'Internal Route — $domain employee automation ($path)',
  ({ domain, path, importPath }) => {
    const originalEnv = process.env.INTERNAL_JOB_TOKEN;

    beforeEach(() => {
      process.env.INTERNAL_JOB_TOKEN = 'test-token';
      mockExecuteDueAutomations.mockReset();
      mockRecordChange.mockReset();
      mockCreateClothingRun.mockReset().mockResolvedValue({ id: 1 });
      mockCreateGMRun.mockReset().mockResolvedValue({ id: 2 });
      mockCreateTruckingRun.mockReset().mockResolvedValue({ id: 3 });
      mockLogger.error.mockReset();
    });

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.INTERNAL_JOB_TOKEN = originalEnv;
      } else {
        delete process.env.INTERNAL_JOB_TOKEN;
      }
    });

    // Token auth (I52–I55)
    it('I54: returns 401 without token', async () => {
      vi.resetModules();
      const mod = await import(importPath);
      const response = await mod.POST(
        makeRequest(`http://localhost${path}`)
      );
      expect(response.status).toBe(401);
    });

    // F35: loads settings and calls executeDueAutomations
    it('F35: calls executeDueAutomations with correct domain', async () => {
      vi.resetModules();
      mockExecuteDueAutomations.mockResolvedValue([
        makeSuccessResult('stayIn'),
      ]);

      const mod = await import(importPath);
      const response = await mod.POST(
        makeRequest(`http://localhost${path}`, 'test-token')
      );

      expect(response.status).toBe(200);
      expect(mockExecuteDueAutomations).toHaveBeenCalledWith(
        expect.objectContaining({ domain })
      );
    });

    // F38: success is true only if no error results
    it('F38: success is true when all results are success or skipped', async () => {
      vi.resetModules();
      mockExecuteDueAutomations.mockResolvedValue([
        makeSuccessResult('stayIn'),
        makeSkippedResult('payroll', 'disabled'),
      ]);

      const mod = await import(importPath);
      const response = await mod.POST(
        makeRequest(`http://localhost${path}`, 'test-token')
      );
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    it('F38: success is false when any result has error status', async () => {
      vi.resetModules();
      mockExecuteDueAutomations.mockResolvedValue([
        makeSuccessResult('stayIn'),
        makeErrorResult('payroll'),
      ]);

      const mod = await import(importPath);
      const response = await mod.POST(
        makeRequest(`http://localhost${path}`, 'test-token')
      );
      const body = await response.json();
      expect(body.success).toBe(false);
    });

    // F39: response includes summary
    it('F39: response includes summary with counts', async () => {
      vi.resetModules();
      mockExecuteDueAutomations.mockResolvedValue([
        makeSuccessResult('stayIn'),
        makeSkippedResult('payroll', 'disabled'),
      ]);

      const mod = await import(importPath);
      const response = await mod.POST(
        makeRequest(`http://localhost${path}`, 'test-token')
      );
      const body = await response.json();

      expect(body.summary).toBeDefined();
      expect(body.summary).toHaveProperty('executed');
      expect(body.summary).toHaveProperty('succeeded');
      expect(body.summary).toHaveProperty('skipped');
      expect(body.summary).toHaveProperty('failed');
    });

    // F37: persisted runs create change-log entries
    it('F37: persists results and records change-log entries', async () => {
      vi.resetModules();
      mockExecuteDueAutomations.mockResolvedValue([
        makeSuccessResult('stayIn'),
      ]);

      const mod = await import(importPath);
      await mod.POST(
        makeRequest(`http://localhost${path}`, 'test-token')
      );

      expect(mockRecordChange).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'employee-automation-run',
          action: 'run',
          metadata: expect.objectContaining({
            domain,
            triggerSource: 'scheduler',
          }),
        }),
        expect.objectContaining({
          source: 'employee-automation-scheduler',
        })
      );
    });

    // Error handling
    it('returns 500 on unexpected error', async () => {
      vi.resetModules();
      mockExecuteDueAutomations.mockRejectedValue(
        new Error('DB connection lost')
      );

      const mod = await import(importPath);
      const response = await mod.POST(
        makeRequest(`http://localhost${path}`, 'test-token')
      );
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  }
);
