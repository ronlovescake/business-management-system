import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockCreateRun,
  mockExecutePayrollAutomation,
  mockExecuteStayInAutomation,
  mockGetOverview,
  mockGetSettings,
  mockLogger,
  mockRecordChange,
  mockRequireAdmin,
  mockUpdateSettings,
} = vi.hoisted(() => ({
  mockCreateRun: vi.fn(),
  mockExecutePayrollAutomation: vi.fn(),
  mockExecuteStayInAutomation: vi.fn(),
  mockGetOverview: vi.fn(),
  mockGetSettings: vi.fn(),
  mockLogger: {
    error: vi.fn(),
  },
  mockRecordChange: vi.fn(),
  mockRequireAdmin: vi.fn(),
  mockUpdateSettings: vi.fn(),
}));

vi.mock('@/lib/settings/employeeAutomation', () => ({
  createEmployeeAutomationRun: mockCreateRun,
  getEmployeeAutomationOverview: mockGetOverview,
  getEmployeeAutomationSettings: mockGetSettings,
  updateEmployeeAutomationSettings: mockUpdateSettings,
}));

vi.mock('@/modules/shared/employees/automation', () => ({
  executePayrollAutomation: mockExecutePayrollAutomation,
  executeStayInAutomation: mockExecuteStayInAutomation,
}));

vi.mock('@/lib/auth/session', () => ({
  requireAdmin: mockRequireAdmin,
}));

vi.mock('@/core/change-log', () => ({
  recordChange: mockRecordChange,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import { GET, PUT, POST } from '@/app/api/employee-automation-settings/route';

describe('Clothing employee automation settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({
      id: 'admin-1',
      name: 'Admin User',
      role: 'ADMIN',
    });
  });

  it('returns overview data on GET', async () => {
    mockGetOverview.mockResolvedValue({
      settings: {
        stayInAutoPresenceEnabled: true,
        stayInAutoPresenceTime: '02:00',
        stayInAutoPresenceTimezone: 'Asia/Manila',
        stayInAutoPresenceGraceMinutes: 0,
        payrollAutoGenerationEnabled: false,
        payrollAutoGenerationTime: '02:00',
        payrollAutoGenerationTimezone: 'Asia/Manila',
      },
      history: [],
    });

    const response = await GET(
      new NextRequest('http://localhost/api/employee-automation-settings', {
        method: 'GET',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      settings: {
        stayInAutoPresenceEnabled: true,
        stayInAutoPresenceTime: '02:00',
        stayInAutoPresenceTimezone: 'Asia/Manila',
        stayInAutoPresenceGraceMinutes: 0,
        payrollAutoGenerationEnabled: false,
        payrollAutoGenerationTime: '02:00',
        payrollAutoGenerationTimezone: 'Asia/Manila',
      },
      history: [],
    });
  });

  it('maps validation errors to 400 on PUT', async () => {
    mockGetSettings.mockResolvedValue({
      stayInAutoPresenceEnabled: true,
      stayInAutoPresenceTime: '02:00',
      stayInAutoPresenceTimezone: 'Asia/Manila',
      stayInAutoPresenceGraceMinutes: 0,
      payrollAutoGenerationEnabled: false,
      payrollAutoGenerationTime: '02:00',
      payrollAutoGenerationTimezone: 'Asia/Manila',
    });

    const validationError = new Error(
      'Invalid time format. Expected HH:mm in 24-hour format.'
    );
    validationError.name = 'ValidationError';
    mockUpdateSettings.mockRejectedValue(validationError);

    const response = await PUT(
      new NextRequest('http://localhost/api/employee-automation-settings', {
        method: 'PUT',
        body: JSON.stringify({ payrollAutoGenerationTime: '25:00' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(
      'Invalid time format. Expected HH:mm in 24-hour format.'
    );
  });

  it('updates settings on PUT and records a change log', async () => {
    mockGetSettings.mockResolvedValue({
      stayInAutoPresenceEnabled: true,
      stayInAutoPresenceTime: '02:00',
      stayInAutoPresenceTimezone: 'Asia/Manila',
      stayInAutoPresenceGraceMinutes: 0,
      payrollAutoGenerationEnabled: false,
      payrollAutoGenerationTime: '02:00',
      payrollAutoGenerationTimezone: 'Asia/Manila',
    });
    mockUpdateSettings.mockResolvedValue({
      stayInAutoPresenceEnabled: false,
      stayInAutoPresenceTime: '02:00',
      stayInAutoPresenceTimezone: 'Asia/Manila',
      stayInAutoPresenceGraceMinutes: 0,
      payrollAutoGenerationEnabled: true,
      payrollAutoGenerationTime: '03:00',
      payrollAutoGenerationTimezone: 'Asia/Manila',
    });

    const response = await PUT(
      new NextRequest('http://localhost/api/employee-automation-settings', {
        method: 'PUT',
        body: JSON.stringify({ payrollAutoGenerationEnabled: true }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.payrollAutoGenerationEnabled).toBe(true);
    expect(mockRecordChange).toHaveBeenCalledTimes(1);
  });

  it('runs stay-in automation on POST with an explicit automation type', async () => {
    mockGetSettings.mockResolvedValue({
      stayInAutoPresenceEnabled: true,
      stayInAutoPresenceTime: '02:00',
      stayInAutoPresenceTimezone: 'Asia/Manila',
      stayInAutoPresenceGraceMinutes: 0,
      payrollAutoGenerationEnabled: false,
      payrollAutoGenerationTime: '02:00',
      payrollAutoGenerationTimezone: 'Asia/Manila',
    });
    mockExecuteStayInAutomation.mockResolvedValue({
      automationType: 'stay-in-attendance',
      status: 'success',
      message: 'Stay-in automation completed.',
      processed: 3,
      inserted: 2,
      skipped: 1,
      periodKey: '2026-04-05',
      targetDate: '2026-04-05',
    });
    mockCreateRun.mockResolvedValue({ id: 'run-1' });

    const response = await POST(
      new NextRequest('http://localhost/api/employee-automation-settings', {
        method: 'POST',
        body: JSON.stringify({ automationType: 'stay-in-attendance' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.result.message).toBe('Stay-in automation completed.');
    expect(mockExecuteStayInAutomation).toHaveBeenCalledWith({
      domain: 'clothing',
      settings: expect.any(Object),
    });
  });

  it('runs payroll automation on POST when requested', async () => {
    mockGetSettings.mockResolvedValue({
      stayInAutoPresenceEnabled: true,
      stayInAutoPresenceTime: '02:00',
      stayInAutoPresenceTimezone: 'Asia/Manila',
      stayInAutoPresenceGraceMinutes: 0,
      payrollAutoGenerationEnabled: true,
      payrollAutoGenerationTime: '03:00',
      payrollAutoGenerationTimezone: 'Asia/Manila',
    });
    mockExecutePayrollAutomation.mockResolvedValue({
      automationType: 'payroll-generation',
      status: 'success',
      message: 'Payroll automation completed.',
      processed: 4,
      inserted: 4,
      skipped: 0,
      periodKey: '2026-04-01:2026-04-15',
      payrollPeriodStart: '2026-04-01',
      payrollPeriodEnd: '2026-04-15',
    });
    mockCreateRun.mockResolvedValue({ id: 'run-2' });

    const response = await POST(
      new NextRequest('http://localhost/api/employee-automation-settings', {
        method: 'POST',
        body: JSON.stringify({ automationType: 'payroll-generation' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.result.message).toBe('Payroll automation completed.');
    expect(mockExecutePayrollAutomation).toHaveBeenCalledWith({
      domain: 'clothing',
      settings: expect.any(Object),
      triggerSource: 'manual',
    });
  });
});
