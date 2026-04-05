import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  attendance: {
    findMany: vi.fn(),
  },
  payroll: {
    count: vi.fn(),
  },
  truckingAttendance: {
    findMany: vi.fn(),
  },
  truckingPayroll: {
    count: vi.fn(),
  },
  generalMerchandiseAttendance: {
    findMany: vi.fn(),
  },
  generalMerchandisePayroll: {
    count: vi.fn(),
  },
}));

const settingsMocks = vi.hoisted(() => ({
  getEmployeeAutomationSettings: vi.fn(),
  findEmployeeAutomationRunForPeriod: vi.fn(),
  getTruckingEmployeeAutomationSettings: vi.fn(),
  findTruckingEmployeeAutomationRunForPeriod: vi.fn(),
  getGeneralMerchandiseEmployeeAutomationSettings: vi.fn(),
  findGeneralMerchandiseEmployeeAutomationRunForPeriod: vi.fn(),
}));

const stayInMocks = vi.hoisted(() => ({
  runStayInAutoPresenceAutomation: vi.fn(),
  runTruckingStayInAutoPresenceAutomation: vi.fn(),
  runGeneralMerchandiseStayInAutoPresenceAutomation: vi.fn(),
}));

const schedulingMocks = vi.hoisted(() => ({
  getDueStayInAutomationTarget: vi.fn(),
  getDuePayrollAutomationPeriod: vi.fn(),
  getStayInBackfillDateRange: vi.fn(),
}));

const payrollRouteInvokerMocks = vi.hoisted(() => ({
  invokePayrollGenerationRoute: vi.fn(),
}));

const currentPayrollPeriodMocks = vi.hoisted(() => ({
  getCurrentPayrollPeriod: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/settings/employeeAutomation', () => ({
  getEmployeeAutomationSettings: settingsMocks.getEmployeeAutomationSettings,
  findEmployeeAutomationRunForPeriod:
    settingsMocks.findEmployeeAutomationRunForPeriod,
}));

vi.mock('@/lib/settings/truckingEmployeeAutomation', () => ({
  getTruckingEmployeeAutomationSettings:
    settingsMocks.getTruckingEmployeeAutomationSettings,
  findTruckingEmployeeAutomationRunForPeriod:
    settingsMocks.findTruckingEmployeeAutomationRunForPeriod,
}));

vi.mock('@/lib/settings/generalMerchandiseEmployeeAutomation', () => ({
  getGeneralMerchandiseEmployeeAutomationSettings:
    settingsMocks.getGeneralMerchandiseEmployeeAutomationSettings,
  findGeneralMerchandiseEmployeeAutomationRunForPeriod:
    settingsMocks.findGeneralMerchandiseEmployeeAutomationRunForPeriod,
}));

vi.mock('@/lib/automation/stayInAutoPresence', () => ({
  runStayInAutoPresenceAutomation: stayInMocks.runStayInAutoPresenceAutomation,
}));

vi.mock('@/lib/automation/stayInAutoPresenceTrucking', () => ({
  runTruckingStayInAutoPresenceAutomation:
    stayInMocks.runTruckingStayInAutoPresenceAutomation,
}));

vi.mock('@/lib/automation/stayInAutoPresenceGeneralMerchandise', () => ({
  runGeneralMerchandiseStayInAutoPresenceAutomation:
    stayInMocks.runGeneralMerchandiseStayInAutoPresenceAutomation,
}));

vi.mock('../scheduling', () => ({
  getDueStayInAutomationTarget: schedulingMocks.getDueStayInAutomationTarget,
  getDuePayrollAutomationPeriod: schedulingMocks.getDuePayrollAutomationPeriod,
  getStayInBackfillDateRange: schedulingMocks.getStayInBackfillDateRange,
}));

vi.mock('../payrollRouteInvoker', () => ({
  invokePayrollGenerationRoute:
    payrollRouteInvokerMocks.invokePayrollGenerationRoute,
}));

vi.mock('@/lib/payroll/currentPayPeriod', () => ({
  getCurrentPayrollPeriod: currentPayrollPeriodMocks.getCurrentPayrollPeriod,
}));

import {
  executePayrollAutomation,
  executeStayInAutomation,
} from '../execution';
import type {
  EmployeeAutomationRunRecord,
  EmployeeAutomationSettings,
} from '../types';

function buildSettings(
  overrides: Partial<EmployeeAutomationSettings> = {}
): EmployeeAutomationSettings {
  return {
    stayInAutoPresenceEnabled: true,
    stayInAutoPresenceTime: '02:00',
    stayInAutoPresenceTimezone: 'Asia/Manila',
    stayInAutoPresenceGraceMinutes: 0,
    payrollAutoGenerationEnabled: true,
    payrollAutoGenerationTime: '02:00',
    payrollAutoGenerationTimezone: 'Asia/Manila',
    payrollAutoGenerationCutoffDays: [5],
    ...overrides,
  };
}

function buildRunRecord(
  overrides: Partial<EmployeeAutomationRunRecord> = {}
): EmployeeAutomationRunRecord {
  return {
    id: 'run-1',
    createdAt: '2026-04-05T07:30:00.000Z',
    automationType: 'payroll-generation',
    triggerSource: 'scheduler',
    status: 'success',
    periodKey: '2026-04-01:2026-04-15',
    targetDate: null,
    payrollPeriodStart: '2026-04-01',
    payrollPeriodEnd: '2026-04-15',
    message: 'Generated payroll.',
    processed: 1,
    inserted: 1,
    skipped: 0,
    triggeredByUserId: null,
    triggeredByUserName: null,
    metadata: undefined,
    ...overrides,
  };
}

describe('employee automation execution dedupe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPayrollPeriodMocks.getCurrentPayrollPeriod.mockReturnValue({
      start: '2026-04-01',
      end: '2026-04-15',
      label: '2026-04-01 to 2026-04-15',
    });
    schedulingMocks.getDuePayrollAutomationPeriod.mockReturnValue({
      periodStart: '2026-04-01',
      periodEnd: '2026-04-15',
      periodKey: '2026-04-01:2026-04-15',
      label: '2026-04-01 to 2026-04-15',
      cutoffDate: '2026-04-05',
    });
    schedulingMocks.getStayInBackfillDateRange.mockReturnValue({
      targetDate: '2026-04-04',
      periodKey: '2026-04-04',
      dateRange: ['2026-04-04'],
    });
    payrollRouteInvokerMocks.invokePayrollGenerationRoute.mockResolvedValue({
      automationType: 'payroll-generation',
      status: 'success',
      message: 'Generated payroll.',
      processed: 1,
      inserted: 1,
      skipped: 0,
      periodKey: '2026-04-01:2026-04-15',
      payrollPeriodStart: '2026-04-01',
      payrollPeriodEnd: '2026-04-15',
    });
    stayInMocks.runStayInAutoPresenceAutomation.mockResolvedValue({
      processed: 1,
      inserted: 1,
      skipped: 0,
      targetDate: '2026-04-04',
      message: 'Auto-recorded stay-in attendance for 2026-04-04.',
    });
  });

  it('reruns payroll automation when the previously generated payroll was deleted', async () => {
    settingsMocks.findEmployeeAutomationRunForPeriod.mockResolvedValue(
      buildRunRecord()
    );
    mockPrisma.payroll.count.mockResolvedValue(0);

    const result = await executePayrollAutomation({
      domain: 'clothing',
      settings: buildSettings(),
      skipIfAlreadyRecorded: true,
    });

    expect(
      payrollRouteInvokerMocks.invokePayrollGenerationRoute
    ).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
  });

  it('keeps skipping payroll automation when the previously generated payroll still exists', async () => {
    settingsMocks.findEmployeeAutomationRunForPeriod.mockResolvedValue(
      buildRunRecord()
    );
    mockPrisma.payroll.count.mockResolvedValue(1);

    const result = await executePayrollAutomation({
      domain: 'clothing',
      settings: buildSettings(),
      skipIfAlreadyRecorded: true,
    });

    expect(
      payrollRouteInvokerMocks.invokePayrollGenerationRoute
    ).not.toHaveBeenCalled();
    expect(result.status).toBe('skipped');
    expect(result.metadata).toMatchObject({
      skipReason: 'already-recorded-run',
    });
  });

  it('uses the current payroll period for manual payroll runs', async () => {
    schedulingMocks.getDuePayrollAutomationPeriod.mockReturnValue({
      periodStart: '2026-03-16',
      periodEnd: '2026-03-31',
      periodKey: '2026-03-16:2026-03-31',
      label: '2026-03-16 to 2026-03-31',
      cutoffDate: '2026-03-31',
    });

    await executePayrollAutomation({
      domain: 'clothing',
      settings: buildSettings(),
      triggerSource: 'manual',
    });

    expect(
      schedulingMocks.getDuePayrollAutomationPeriod
    ).not.toHaveBeenCalled();
    expect(
      currentPayrollPeriodMocks.getCurrentPayrollPeriod
    ).toHaveBeenCalledTimes(1);
    expect(
      payrollRouteInvokerMocks.invokePayrollGenerationRoute
    ).toHaveBeenCalledWith({
      domain: 'clothing',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-15',
      label: '2026-04-01 to 2026-04-15',
      periodKey: '2026-04-01:2026-04-15',
    });
  });

  it('reruns stay-in attendance when the previously auto-generated entries were deleted', async () => {
    settingsMocks.findEmployeeAutomationRunForPeriod.mockResolvedValue(
      buildRunRecord({
        automationType: 'stay-in-attendance',
        periodKey: '2026-04-04',
        targetDate: '2026-04-04',
        payrollPeriodStart: null,
        payrollPeriodEnd: null,
        inserted: 1,
        metadata: {
          results: [{ targetDate: '2026-04-04', inserted: 1 }],
        },
      })
    );
    mockPrisma.attendance.findMany.mockResolvedValue([]);

    const result = await executeStayInAutomation({
      domain: 'clothing',
      settings: buildSettings(),
      skipIfAlreadyRecorded: true,
      backfillLookbackDays: 15,
    });

    expect(stayInMocks.runStayInAutoPresenceAutomation).toHaveBeenCalledTimes(
      1
    );
    expect(result.status).toBe('success');
  });

  it('keeps skipping stay-in attendance when the previous auto-generated entries still exist', async () => {
    settingsMocks.findEmployeeAutomationRunForPeriod.mockResolvedValue(
      buildRunRecord({
        automationType: 'stay-in-attendance',
        periodKey: '2026-04-04',
        targetDate: '2026-04-04',
        payrollPeriodStart: null,
        payrollPeriodEnd: null,
        inserted: 1,
        metadata: {
          results: [{ targetDate: '2026-04-04', inserted: 1 }],
        },
      })
    );
    mockPrisma.attendance.findMany.mockResolvedValue([{ date: '2026-04-04' }]);

    const result = await executeStayInAutomation({
      domain: 'clothing',
      settings: buildSettings(),
      skipIfAlreadyRecorded: true,
      backfillLookbackDays: 15,
    });

    expect(stayInMocks.runStayInAutoPresenceAutomation).not.toHaveBeenCalled();
    expect(result.status).toBe('skipped');
    expect(result.metadata).toMatchObject({
      skipReason: 'already-recorded-run',
    });
  });
});
