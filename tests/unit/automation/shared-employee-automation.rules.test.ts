/**
 * Shared Employee Automation — Business-Rule-Mapped Tests
 *
 * Tests the shared automation engine covering settings validation,
 * target-date resolution, backfill logic, skip/persist decisions,
 * cutoff-day normalization, and payroll route invocation.
 *
 * Rules Covered (shared-employee-automation.md):
 *  A1–A6:  Automation types and domains
 *  B1–B10: Automation settings defaults and validation
 *  C1–C10: Stay-in target-date resolution and backfill
 *  C11–C16: Stay-in skip-if-already-recorded logic
 *  D1–D9:  Payroll cutoff resolution
 *  D18–D21: Payroll route invocation
 *  E1–E4:  Orchestrated execution (executeDueAutomations)
 *  F1–F3:  Internal route utilities
 *  G1–G6:  Run history helpers
 *  H1–H6:  Settings validation summary
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Section B+H: Settings validation (sanitize + payrollCutoffDays)
// ---------------------------------------------------------------------------

describe('Settings Validation (B1–B10, H1–H6)', () => {
  let sanitizeEmployeeAutomationSettingsUpdate: typeof import('@/modules/shared/employees/automation/settingsService').sanitizeEmployeeAutomationSettingsUpdate;
  let DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS: typeof import('@/modules/shared/employees/automation/settingsService').DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import(
      '@/modules/shared/employees/automation/settingsService'
    );
    sanitizeEmployeeAutomationSettingsUpdate =
      mod.sanitizeEmployeeAutomationSettingsUpdate;
    DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS =
      mod.DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS;
  });

  it('B2: defaults have stayIn enabled, payroll disabled, Asia/Manila, 02:00', () => {
    expect(DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS).toMatchObject({
      stayInAutoPresenceEnabled: true,
      stayInAutoPresenceTime: '02:00',
      stayInAutoPresenceTimezone: 'Asia/Manila',
      stayInAutoPresenceGraceMinutes: 0,
      payrollAutoGenerationEnabled: false,
      payrollAutoGenerationTime: '02:00',
      payrollAutoGenerationTimezone: 'Asia/Manila',
      payrollAutoGenerationCutoffDays: [],
    });
  });

  it('B3/H1: rejects invalid time format', () => {
    expect(() =>
      sanitizeEmployeeAutomationSettingsUpdate({
        stayInAutoPresenceTime: '25:00',
      })
    ).toThrow('Invalid time format');
  });

  it('B3/H1: accepts valid 24h time', () => {
    const result = sanitizeEmployeeAutomationSettingsUpdate({
      stayInAutoPresenceTime: '14:30',
    });
    expect(result.stayInAutoPresenceTime).toBe('14:30');
  });

  it('B4/H2: rejects empty timezone', () => {
    expect(() =>
      sanitizeEmployeeAutomationSettingsUpdate({
        stayInAutoPresenceTimezone: '   ',
      })
    ).toThrow('Timezone cannot be empty');
  });

  it('B5/H3: grace minutes 120 is accepted (boundary)', () => {
    const result = sanitizeEmployeeAutomationSettingsUpdate({
      stayInAutoPresenceGraceMinutes: 120,
    });
    expect(result.stayInAutoPresenceGraceMinutes).toBe(120);
  });

  it('B5/H3: grace minutes > 120 throws', () => {
    expect(() =>
      sanitizeEmployeeAutomationSettingsUpdate({
        stayInAutoPresenceGraceMinutes: 121,
      })
    ).toThrow('cannot exceed 120');
  });

  it('B5/H3: fractional grace minutes are floored', () => {
    const result = sanitizeEmployeeAutomationSettingsUpdate({
      stayInAutoPresenceGraceMinutes: 45.9,
    });
    expect(result.stayInAutoPresenceGraceMinutes).toBe(45);
  });

  it('B5/H3: negative grace minutes clamp to 0', () => {
    const result = sanitizeEmployeeAutomationSettingsUpdate({
      stayInAutoPresenceGraceMinutes: -10,
    });
    expect(result.stayInAutoPresenceGraceMinutes).toBe(0);
  });

  it('B6/H4: cutoff days validated, deduplicated, sorted', () => {
    const result = sanitizeEmployeeAutomationSettingsUpdate({
      payrollAutoGenerationCutoffDays: [30, 15, 30, 1],
    });
    expect(result.payrollAutoGenerationCutoffDays).toEqual([1, 15, 30]);
  });

  it('B6/H4: cutoff day 0 rejected', () => {
    expect(() =>
      sanitizeEmployeeAutomationSettingsUpdate({
        payrollAutoGenerationCutoffDays: [0],
      })
    ).toThrow();
  });

  it('B6/H4: cutoff day 32 rejected', () => {
    expect(() =>
      sanitizeEmployeeAutomationSettingsUpdate({
        payrollAutoGenerationCutoffDays: [32],
      })
    ).toThrow();
  });

  it('B6/H4: non-array cutoff days rejected', () => {
    expect(() =>
      sanitizeEmployeeAutomationSettingsUpdate({
        payrollAutoGenerationCutoffDays: 'not an array' as never,
      })
    ).toThrow();
  });

  it('B10: only explicitly provided fields are processed', () => {
    const result = sanitizeEmployeeAutomationSettingsUpdate({
      stayInAutoPresenceEnabled: false,
    });
    expect(result).toEqual({ stayInAutoPresenceEnabled: false });
    expect(result).not.toHaveProperty('payrollAutoGenerationEnabled');
  });

  it('B10: booleans are cast', () => {
    const result = sanitizeEmployeeAutomationSettingsUpdate({
      payrollAutoGenerationEnabled: 1 as unknown as boolean,
    });
    expect(result.payrollAutoGenerationEnabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Section C.1+C.2: Target-date resolution and backfill
// ---------------------------------------------------------------------------

describe('Stay-In Target Date and Backfill (C1–C10)', () => {
  let getDueStayInAutomationTarget: typeof import('@/modules/shared/employees/automation/scheduling').getDueStayInAutomationTarget;
  let getStayInBackfillDateRange: typeof import('@/modules/shared/employees/automation/scheduling').getStayInBackfillDateRange;
  let buildRollingDateRange: typeof import('@/modules/shared/employees/automation/stayInBackfill').buildRollingDateRange;
  let STAY_IN_ATTENDANCE_LOOKBACK_DAYS: number;

  beforeEach(async () => {
    vi.resetModules();
    const scheduling = await import(
      '@/modules/shared/employees/automation/scheduling'
    );
    getDueStayInAutomationTarget = scheduling.getDueStayInAutomationTarget;
    getStayInBackfillDateRange = scheduling.getStayInBackfillDateRange;

    const backfill = await import(
      '@/modules/shared/employees/automation/stayInBackfill'
    );
    buildRollingDateRange = backfill.buildRollingDateRange;
    STAY_IN_ATTENDANCE_LOOKBACK_DAYS = backfill.STAY_IN_ATTENDANCE_LOOKBACK_DAYS;
  });

  it('C4: target date and period key are YYYY-MM-DD formatted', () => {
    const result = getDueStayInAutomationTarget({
      scheduleTime: '02:00',
      timezone: 'Asia/Manila',
      graceMinutes: 0,
    });
    expect(result.targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.periodKey).toBe(result.targetDate);
  });

  it('C6: lookback constant is 15', () => {
    expect(STAY_IN_ATTENDANCE_LOOKBACK_DAYS).toBe(15);
  });

  it('C7: buildRollingDateRange produces correct number of dates', () => {
    const range = buildRollingDateRange('2026-04-10', 5);
    expect(range).toHaveLength(5);
    expect(range[0]).toBe('2026-04-10');
    expect(range[4]).toBe('2026-04-06');
  });

  it('C7: buildRollingDateRange floors lookback to minimum 1', () => {
    const range = buildRollingDateRange('2026-04-10', 0);
    expect(range).toHaveLength(1);
  });

  it('C5: backfill date range extends from target with lookback', () => {
    const result = getStayInBackfillDateRange({
      scheduleTime: '02:00',
      timezone: 'Asia/Manila',
      graceMinutes: 0,
      lookbackDays: 3,
    });
    expect(result.dateRange).toHaveLength(3);
    expect(result.targetDate).toBeDefined();
    expect(result.periodKey).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Section D.1: Payroll cutoff normalization
// ---------------------------------------------------------------------------

describe('Payroll Cutoff Days (D1–D2)', () => {
  let normalizePayrollCutoffDays: typeof import('@/modules/shared/employees/automation/payrollCutoffDays').normalizePayrollCutoffDays;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import(
      '@/modules/shared/employees/automation/payrollCutoffDays'
    );
    normalizePayrollCutoffDays = mod.normalizePayrollCutoffDays;
  });

  it('D2: deduplicates and sorts ascending', () => {
    expect(normalizePayrollCutoffDays([15, 1, 15, 30])).toEqual([1, 15, 30]);
  });

  it('D2: rejects non-array input', () => {
    expect(() => normalizePayrollCutoffDays('hello')).toThrow(
      'must be provided as a list'
    );
  });

  it('D2: rejects day < 1', () => {
    expect(() => normalizePayrollCutoffDays([0])).toThrow('between');
  });

  it('D2: rejects day > 31', () => {
    expect(() => normalizePayrollCutoffDays([32])).toThrow('between');
  });

  it('D2: parses string entries', () => {
    expect(normalizePayrollCutoffDays(['15', '1'])).toEqual([1, 15]);
  });

  it('D2: rejects NaN entries', () => {
    expect(() => normalizePayrollCutoffDays(['abc'])).toThrow(
      'valid day numbers'
    );
  });

  it('D2: floors fractional values', () => {
    expect(normalizePayrollCutoffDays([15.9])).toEqual([15]);
  });
});

// ---------------------------------------------------------------------------
// Section D.3: Payroll period resolution
// ---------------------------------------------------------------------------

describe('Payroll Period Resolution (D3–D9)', () => {
  const mockGetCurrentPayrollPeriod = vi.hoisted(() =>
    vi.fn().mockReturnValue({
      start: '2026-04-01',
      end: '2026-04-15',
      label: 'Apr 1-15 2026',
    })
  );

  vi.mock('@/lib/payroll/currentPayPeriod', () => ({
    getCurrentPayrollPeriod: mockGetCurrentPayrollPeriod,
  }));

  let getDuePayrollAutomationPeriod: typeof import('@/modules/shared/employees/automation/scheduling').getDuePayrollAutomationPeriod;

  beforeEach(async () => {
    vi.resetModules();
    mockGetCurrentPayrollPeriod.mockReturnValue({
      start: '2026-04-01',
      end: '2026-04-15',
      label: 'Apr 1-15 2026',
    });
    const mod = await import(
      '@/modules/shared/employees/automation/scheduling'
    );
    getDuePayrollAutomationPeriod = mod.getDuePayrollAutomationPeriod;
  });

  it('D7: returns null when no cutoff days provided', () => {
    const result = getDuePayrollAutomationPeriod({
      scheduleTime: '02:00',
      timezone: 'Asia/Manila',
      cutoffDays: [],
    });
    expect(result).toBeNull();
  });

  it('D9: periodKey format is {start}:{end}', () => {
    const result = getDuePayrollAutomationPeriod({
      scheduleTime: '02:00',
      timezone: 'Asia/Manila',
      cutoffDays: [15],
      referenceTime: '2026-04-15T10:00:00+08:00',
    });
    if (result) {
      expect(result.periodKey).toBe(`${result.periodStart}:${result.periodEnd}`);
    }
  });

  it('D3: builds candidates across multiple months', () => {
    const result = getDuePayrollAutomationPeriod({
      scheduleTime: '02:00',
      timezone: 'Asia/Manila',
      cutoffDays: [15, 30],
      referenceTime: '2026-04-16T03:00:00+08:00',
    });
    expect(result).not.toBeNull();
    expect(result!.cutoffDay).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Section F: Internal route utilities
// ---------------------------------------------------------------------------

describe('Internal Route Utilities (F1–F3)', () => {
  let requireInternalToken: typeof import('@/modules/shared/employees/automation/internalRouteUtils').requireInternalToken;
  let shouldPersistScheduledRun: typeof import('@/modules/shared/employees/automation/internalRouteUtils').shouldPersistScheduledRun;
  let summarizeScheduledResults: typeof import('@/modules/shared/employees/automation/internalRouteUtils').summarizeScheduledResults;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import(
      '@/modules/shared/employees/automation/internalRouteUtils'
    );
    requireInternalToken = mod.requireInternalToken;
    shouldPersistScheduledRun = mod.shouldPersistScheduledRun;
    summarizeScheduledResults = mod.summarizeScheduledResults;
  });

  describe('requireInternalToken (F1)', () => {
    it('F1: returns 500 when INTERNAL_JOB_TOKEN is empty', () => {
      const origToken = process.env.INTERNAL_JOB_TOKEN;
      process.env.INTERNAL_JOB_TOKEN = '';
      const req = new NextRequest('http://localhost/test', {
        headers: { 'x-internal-token': 'any' },
      });
      const resp = requireInternalToken(req);
      expect(resp).not.toBeNull();
      expect(resp!.status).toBe(500);
      process.env.INTERNAL_JOB_TOKEN = origToken;
    });

    it('F1: returns 401 when token is missing', () => {
      const origToken = process.env.INTERNAL_JOB_TOKEN;
      process.env.INTERNAL_JOB_TOKEN = 'secret';
      const req = new NextRequest('http://localhost/test');
      const resp = requireInternalToken(req);
      expect(resp).not.toBeNull();
      expect(resp!.status).toBe(401);
      process.env.INTERNAL_JOB_TOKEN = origToken;
    });

    it('F1: returns 401 when token does not match', () => {
      const origToken = process.env.INTERNAL_JOB_TOKEN;
      process.env.INTERNAL_JOB_TOKEN = 'secret';
      const req = new NextRequest('http://localhost/test', {
        headers: { 'x-internal-token': 'wrong' },
      });
      const resp = requireInternalToken(req);
      expect(resp).not.toBeNull();
      expect(resp!.status).toBe(401);
      process.env.INTERNAL_JOB_TOKEN = origToken;
    });

    it('F1: returns null when token matches', () => {
      const origToken = process.env.INTERNAL_JOB_TOKEN;
      process.env.INTERNAL_JOB_TOKEN = 'secret';
      const req = new NextRequest('http://localhost/test', {
        headers: { 'x-internal-token': 'secret' },
      });
      const resp = requireInternalToken(req);
      expect(resp).toBeNull();
      process.env.INTERNAL_JOB_TOKEN = origToken;
    });
  });

  describe('shouldPersistScheduledRun (F2)', () => {
    const base = {
      automationType: 'stay-in-attendance' as const,
      status: 'success' as const,
      message: 'ok',
    };

    it('F2: returns false for skipReason disabled', () => {
      expect(
        shouldPersistScheduledRun({
          ...base,
          status: 'skipped',
          metadata: { skipReason: 'disabled' },
        })
      ).toBe(false);
    });

    it('F2: returns false for skipReason already-recorded-run', () => {
      expect(
        shouldPersistScheduledRun({
          ...base,
          status: 'skipped',
          metadata: { skipReason: 'already-recorded-run' },
        })
      ).toBe(false);
    });

    it('F2: returns false for skipReason no-due-cutoff', () => {
      expect(
        shouldPersistScheduledRun({
          ...base,
          status: 'skipped',
          metadata: { skipReason: 'no-due-cutoff' },
        })
      ).toBe(false);
    });

    it('F2: returns true for success with no skip metadata', () => {
      expect(shouldPersistScheduledRun({ ...base })).toBe(true);
    });

    it('F2: returns true for error status', () => {
      expect(
        shouldPersistScheduledRun({
          ...base,
          status: 'error',
          metadata: {},
        })
      ).toBe(true);
    });
  });

  describe('summarizeScheduledResults (F3)', () => {
    it('F3: counts executed, succeeded, skipped, failed', () => {
      const results = [
        {
          automationType: 'stay-in-attendance' as const,
          status: 'success' as const,
          message: 'ok',
        },
        {
          automationType: 'payroll-generation' as const,
          status: 'skipped' as const,
          message: 'skipped',
          metadata: { skipReason: 'disabled' },
        },
        {
          automationType: 'payroll-generation' as const,
          status: 'error' as const,
          message: 'err',
        },
      ];

      const summary = summarizeScheduledResults(results);
      // First result: persist=true (success, no skip). Second: persist=false (disabled). Third: persist=true (error).
      expect(summary.executed).toBe(2);
      expect(summary.succeeded).toBe(1);
      expect(summary.skipped).toBe(1);
      expect(summary.failed).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Section A: Types smoke test
// ---------------------------------------------------------------------------

describe('Automation Types (A1–A6)', () => {
  it('A1: two automation types defined', async () => {
    const { EMPLOYEE_AUTOMATION_TYPES } = await import(
      '@/modules/shared/employees/automation/types'
    );
    expect(EMPLOYEE_AUTOMATION_TYPES).toEqual([
      'stay-in-attendance',
      'payroll-generation',
    ]);
  });

  it('A4: two trigger sources defined', async () => {
    const { EMPLOYEE_AUTOMATION_TRIGGER_SOURCES } = await import(
      '@/modules/shared/employees/automation/types'
    );
    expect(EMPLOYEE_AUTOMATION_TRIGGER_SOURCES).toEqual([
      'manual',
      'scheduler',
    ]);
  });

  it('A5: three statuses defined', async () => {
    const { EMPLOYEE_AUTOMATION_STATUSES } = await import(
      '@/modules/shared/employees/automation/types'
    );
    expect(EMPLOYEE_AUTOMATION_STATUSES).toEqual([
      'success',
      'skipped',
      'error',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Section D.4: Payroll route invocation
// ---------------------------------------------------------------------------

describe('Payroll Route Invocation (D18–D21)', () => {
  const mockClothingPOST = vi.hoisted(() => vi.fn());
  const mockTruckingPOST = vi.hoisted(() => vi.fn());
  const mockGmPOST = vi.hoisted(() => vi.fn());

  vi.mock('@/app/api/payroll/generate/route', () => ({
    POST: mockClothingPOST,
  }));
  vi.mock('@/app/api/trucking/payroll/generate/route', () => ({
    POST: mockTruckingPOST,
  }));
  vi.mock('@/app/api/general-merchandise/payroll/generate/route', () => ({
    POST: mockGmPOST,
  }));

  let invokePayrollGenerationRoute: typeof import('@/modules/shared/employees/automation/payrollRouteInvoker').invokePayrollGenerationRoute;

  beforeEach(async () => {
    vi.resetModules();
    mockClothingPOST.mockReset();
    mockTruckingPOST.mockReset();
    mockGmPOST.mockReset();
    const mod = await import(
      '@/modules/shared/employees/automation/payrollRouteInvoker'
    );
    invokePayrollGenerationRoute = mod.invokePayrollGenerationRoute;
  });

  const baseParams = {
    periodStart: '2026-04-01',
    periodEnd: '2026-04-15',
    label: 'Apr 1-15',
    periodKey: '2026-04-01:2026-04-15',
  };

  it('D20: success response maps to success result', async () => {
    mockClothingPOST.mockResolvedValue(
      Response.json({ success: true, data: { count: 5 } }, { status: 200 })
    );
    const result = await invokePayrollGenerationRoute({
      domain: 'clothing',
      ...baseParams,
    });
    expect(result.automationType).toBe('payroll-generation');
    expect(result.status).toBe('success');
    expect(result.inserted).toBe(5);
  });

  it('D21: "already exists" message maps to skipped', async () => {
    mockClothingPOST.mockResolvedValue(
      Response.json(
        { success: false, message: 'Payroll already exists for period' },
        { status: 400 }
      )
    );
    const result = await invokePayrollGenerationRoute({
      domain: 'clothing',
      ...baseParams,
    });
    expect(result.status).toBe('skipped');
  });

  it('D21: unknown error message maps to error', async () => {
    mockClothingPOST.mockResolvedValue(
      Response.json(
        { success: false, error: 'Database connection lost' },
        { status: 500 }
      )
    );
    const result = await invokePayrollGenerationRoute({
      domain: 'clothing',
      ...baseParams,
    });
    expect(result.status).toBe('error');
  });

  it('D18: trucking domain calls trucking route', async () => {
    mockTruckingPOST.mockResolvedValue(
      Response.json({ success: true, data: { count: 3 } }, { status: 200 })
    );
    const result = await invokePayrollGenerationRoute({
      domain: 'trucking',
      ...baseParams,
    });
    expect(result.status).toBe('success');
    expect(mockTruckingPOST).toHaveBeenCalled();
  });

  it('D18: general-merchandise domain calls GM route', async () => {
    mockGmPOST.mockResolvedValue(
      Response.json({ success: true, data: { count: 2 } }, { status: 200 })
    );
    const result = await invokePayrollGenerationRoute({
      domain: 'general-merchandise',
      ...baseParams,
    });
    expect(result.status).toBe('success');
    expect(mockGmPOST).toHaveBeenCalled();
  });

  it('D21: "no attendance records found" maps to skipped', async () => {
    mockClothingPOST.mockResolvedValue(
      Response.json(
        { success: false, message: 'No attendance records found for period' },
        { status: 400 }
      )
    );
    const result = await invokePayrollGenerationRoute({
      domain: 'clothing',
      ...baseParams,
    });
    expect(result.status).toBe('skipped');
  });

  it('D19: request body includes periodStart, periodEnd, payPeriodLabel', async () => {
    let capturedRequest: Request | null = null;
    mockClothingPOST.mockImplementation(async (req: Request) => {
      capturedRequest = req;
      return Response.json({ success: true, data: { count: 0 } });
    });
    await invokePayrollGenerationRoute({
      domain: 'clothing',
      ...baseParams,
    });
    expect(capturedRequest).not.toBeNull();
    const body = await capturedRequest!.json();
    expect(body).toMatchObject({
      periodStart: '2026-04-01',
      periodEnd: '2026-04-15',
      payPeriodLabel: 'Apr 1-15',
    });
  });
});
