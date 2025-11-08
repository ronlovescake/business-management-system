import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Payroll } from '@prisma/client';
import {
  syncPayrollAttendanceDeductions,
  syncPayrollLwop,
} from '../deductions';

const mocks = vi.hoisted(() => ({
  employeeFindMany: vi.fn(),
  leaveFindMany: vi.fn(),
  attendanceFindMany: vi.fn(),
  scheduleFindMany: vi.fn(),
  payrollUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    employee: { findMany: mocks.employeeFindMany },
    leaveRequest: { findMany: mocks.leaveFindMany },
    attendance: { findMany: mocks.attendanceFindMany },
    schedule: { findMany: mocks.scheduleFindMany },
    payroll: { update: mocks.payrollUpdate },
    $transaction: mocks.transaction,
  },
}));

const buildPayroll = (overrides: Partial<Payroll> = {}): Payroll => ({
  id: overrides.id ?? 'payroll-1',
  createdAt: overrides.createdAt ?? new Date('2025-10-01T00:00:00.000Z'),
  updatedAt: overrides.updatedAt ?? new Date('2025-10-01T00:00:00.000Z'),
  deletedAt: overrides.deletedAt ?? null,
  employeeId: overrides.employeeId ?? 'EMP-001',
  employeeName: overrides.employeeName ?? 'John Doe',
  payPeriod: overrides.payPeriod ?? '2025-10-01 to 2025-10-15',
  periodStart: overrides.periodStart ?? '2025-10-01',
  periodEnd: overrides.periodEnd ?? '2025-10-15',
  basicSalary: overrides.basicSalary ?? 26000,
  allowance: overrides.allowance ?? 0,
  overtime: overrides.overtime ?? 0,
  bonuses: overrides.bonuses ?? 0,
  thirteenthMonth: overrides.thirteenthMonth ?? 0,
  grossPay: overrides.grossPay ?? 26000,
  sss: overrides.sss ?? 0,
  philHealth: overrides.philHealth ?? 0,
  pagIbig: overrides.pagIbig ?? 0,
  tax: overrides.tax ?? 0,
  loans: overrides.loans ?? 0,
  cashAdvance: overrides.cashAdvance ?? 0,
  lwop: overrides.lwop ?? 0,
  absentsLates: overrides.absentsLates ?? 0,
  totalDeductions: overrides.totalDeductions ?? 0,
  netPay: overrides.netPay ?? 26000,
  status: overrides.status ?? 'pending',
  bankGcash: overrides.bankGcash ?? '',
  approvedBy: overrides.approvedBy ?? null,
  approvedDate: overrides.approvedDate ?? null,
  paidDate: overrides.paidDate ?? null,
  unpaidDays: overrides.unpaidDays ?? 0,
  dailyRate: overrides.dailyRate ?? 0,
  deduction: overrides.deduction ?? 0,
  notes: overrides.notes ?? null,
});

describe('syncPayrollLwop', () => {
  beforeEach(() => {
    mocks.employeeFindMany.mockReset();
    mocks.leaveFindMany.mockReset();
    mocks.payrollUpdate.mockReset();
    mocks.transaction.mockReset();
  });

  it('returns early when no payrolls provided', async () => {
    const result = await syncPayrollLwop([]);

    expect(result).toEqual([]);
    expect(mocks.employeeFindMany).not.toHaveBeenCalled();
    expect(mocks.leaveFindMany).not.toHaveBeenCalled();
    expect(mocks.payrollUpdate).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('applies LWOP deductions for unpaid leaves within the period', async () => {
    const payroll = buildPayroll();

    mocks.employeeFindMany.mockResolvedValue([
      { employeeId: 'EMP-001', basicSalary: 26000, currentSalary: 26000 },
    ]);

    mocks.leaveFindMany.mockResolvedValue([
      {
        id: 1,
        employeeId: 'EMP-001',
        startDate: '2025-10-01',
        endDate: '2025-10-03',
        numberOfDays: 3,
      },
    ]);

    // Mock schedules for LWOP calculation
    mocks.scheduleFindMany.mockResolvedValue([
      {
        id: 'sched-1',
        employeeId: 'EMP-001',
        date: '2025-10-01',
        startTime: '08:00',
        endTime: '17:00',
        shiftType: 'regular',
      },
      {
        id: 'sched-2',
        employeeId: 'EMP-001',
        date: '2025-10-02',
        startTime: '08:00',
        endTime: '17:00',
        shiftType: 'regular',
      },
      {
        id: 'sched-3',
        employeeId: 'EMP-001',
        date: '2025-10-03',
        startTime: '08:00',
        endTime: '17:00',
        shiftType: 'regular',
      },
    ]);

    mocks.payrollUpdate.mockImplementation(
      async ({ data }: { data: Partial<Payroll> }) => ({
        ...payroll,
        ...data,
      })
    );

    mocks.transaction.mockImplementation(
      async (operations: Promise<Payroll>[]) => Promise.all(operations)
    );

    const result = await syncPayrollLwop([payroll]);

    expect(mocks.employeeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeId: { in: ['EMP-001'] } } })
    );
    expect(mocks.leaveFindMany).toHaveBeenCalled();
    expect(mocks.payrollUpdate).toHaveBeenCalledWith({
      where: { id: 'payroll-1' },
      data: {
        lwop: 3000,
        unpaidDays: 3,
        dailyRate: 1000,
        deduction: 3000,
        totalDeductions: 3000,
        netPay: 23000,
      },
    });

    const [updated] = result;
    expect(updated.lwop).toBe(3000);
    expect(updated.unpaidDays).toBe(3);
    expect(updated.dailyRate).toBe(1000);
    expect(updated.deduction).toBe(3000);
    expect(updated.totalDeductions).toBe(3000);
    expect(updated.netPay).toBe(23000);
  });

  it('skips persistence when lwop already matches computed totals', async () => {
    const payrolls = [
      buildPayroll({
        id: 'payroll-1',
        employeeId: 'EMP-001',
        periodStart: '2025-10-01',
        periodEnd: '2025-10-15',
        lwop: 3000, // Already has computed LWOP
        unpaidDays: 3,
        dailyRate: 1000,
        deduction: 3000,
        totalDeductions: 3000,
        netPay: 23000,
      }),
    ];

    const mockLeaveApprovals = [
      {
        id: 1,
        employeeId: 'EMP-001',
        startDate: '2025-10-02',
        endDate: '2025-10-04',
        numberOfDays: 3,
      },
    ];

    const mockSchedules = [
      {
        id: 'sched-1',
        employeeId: 'EMP-001',
        date: '2025-10-02',
        shift: 'Day',
      },
      {
        id: 'sched-2',
        employeeId: 'EMP-001',
        date: '2025-10-03',
        shift: 'Day',
      },
      {
        id: 'sched-3',
        employeeId: 'EMP-001',
        date: '2025-10-04',
        shift: 'Day',
      },
    ];

    mocks.employeeFindMany.mockResolvedValue([
      { employeeId: 'EMP-001', basicSalary: 26000, currentSalary: 26000 },
    ]);
    mocks.leaveFindMany.mockResolvedValue(mockLeaveApprovals);
    mocks.scheduleFindMany.mockResolvedValue(mockSchedules);

    const result = await syncPayrollLwop([...payrolls]);

    // Should not trigger update since lwop already matches
    expect(mocks.payrollUpdate).not.toHaveBeenCalled();
    expect(result[0].lwop).toBe(3000);
  });
});

describe('syncPayrollAttendanceDeductions', () => {
  beforeEach(() => {
    mocks.employeeFindMany.mockReset();
    mocks.leaveFindMany.mockReset();
    mocks.attendanceFindMany.mockReset();
    mocks.scheduleFindMany.mockReset();
    mocks.payrollUpdate.mockReset();
    mocks.transaction.mockReset();

    // Default transaction mock
    mocks.transaction.mockImplementation(
      async (operations: Promise<Payroll>[]) => Promise.all(operations)
    );
  });

  it('calculates absents and late deductions using attendance data', async () => {
    const payroll = buildPayroll();

    mocks.employeeFindMany.mockResolvedValue([
      { employeeId: 'EMP-001', basicSalary: 26000, currentSalary: 26000 },
    ]);

    mocks.leaveFindMany.mockResolvedValue([]);

    mocks.attendanceFindMany.mockResolvedValue([
      {
        id: 'att-1',
        employeeId: 'EMP-001',
        date: '2025-10-05',
        timeIn: '08:30',
        timeOut: '16:45',
        totalHours: 7.5,
        status: 'late',
      },
      {
        id: 'att-2',
        employeeId: 'EMP-001',
        date: '2025-10-07',
        timeIn: '',
        timeOut: '',
        totalHours: 0,
        status: 'absent',
      },
    ]);

    mocks.scheduleFindMany.mockResolvedValue([
      {
        id: 'sched-1',
        employeeId: 'EMP-001',
        date: '2025-10-05',
        startTime: '08:00',
        endTime: '17:00',
        shiftType: 'full-day',
      },
      {
        id: 'sched-2',
        employeeId: 'EMP-001',
        date: '2025-10-07',
        startTime: '08:00',
        endTime: '17:00',
        shiftType: 'full-day',
      },
    ]);

    mocks.payrollUpdate.mockImplementation(
      async ({ data }: { data: Partial<Payroll> }) => ({
        ...payroll,
        ...data,
      })
    );

    mocks.transaction.mockImplementation(
      async (operations: Promise<Payroll>[]) => Promise.all(operations)
    );

    const result = await syncPayrollAttendanceDeductions([payroll]);

    expect(mocks.employeeFindMany).toHaveBeenCalled();
    expect(mocks.attendanceFindMany).toHaveBeenCalled();
    expect(mocks.scheduleFindMany).toHaveBeenCalled();

    const expectedDeduction = 1093.75; // 1 absent day (1000) + 45 late/undertime minutes (93.75)

    expect(mocks.payrollUpdate).toHaveBeenCalledWith({
      where: { id: 'payroll-1' },
      data: {
        absentsLates: expectedDeduction,
        totalDeductions: expectedDeduction,
        netPay: 24906.25,
      },
    });

    const [updated] = result;
    expect(updated.absentsLates).toBe(expectedDeduction);
    expect(updated.totalDeductions).toBe(expectedDeduction);
    expect(updated.netPay).toBe(24906.25);
  });

  it('does not update payroll when totals already match computed values', async () => {
    const payroll = buildPayroll({
      absentsLates: 1093.75,
      totalDeductions: 1093.75,
      netPay: 24906.25,
    });

    mocks.employeeFindMany.mockResolvedValue([
      { employeeId: 'EMP-001', basicSalary: 26000, currentSalary: 26000 },
    ]);

    mocks.leaveFindMany.mockResolvedValue([]);

    mocks.attendanceFindMany.mockResolvedValue([
      {
        id: 'att-1',
        employeeId: 'EMP-001',
        date: '2025-10-05',
        timeIn: '08:30',
        timeOut: '16:45',
        totalHours: 7.5,
        status: 'late',
      },
      {
        id: 'att-2',
        employeeId: 'EMP-001',
        date: '2025-10-07',
        timeIn: '',
        timeOut: '',
        totalHours: 0,
        status: 'absent',
      },
    ]);

    mocks.scheduleFindMany.mockResolvedValue([
      {
        id: 'sched-1',
        employeeId: 'EMP-001',
        date: '2025-10-05',
        startTime: '08:00',
        endTime: '17:00',
        shiftType: 'full-day',
      },
      {
        id: 'sched-2',
        employeeId: 'EMP-001',
        date: '2025-10-07',
        startTime: '08:00',
        endTime: '17:00',
        shiftType: 'full-day',
      },
    ]);

    const result = await syncPayrollAttendanceDeductions([payroll]);

    expect(mocks.payrollUpdate).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();

    const [unchanged] = result;
    expect(unchanged.absentsLates).toBe(1093.75);
    expect(unchanged.totalDeductions).toBe(1093.75);
    expect(unchanged.netPay).toBe(24906.25);
  });

  it('does not penalize future scheduled days without attendance records', async () => {
    // Use a future period that hasn't started yet
    const payroll = buildPayroll({
      payPeriod: '2025-11-01 to 2025-11-15',
      periodStart: '2025-11-01',
      periodEnd: '2025-11-15',
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-10-25T08:00:00.000Z'));

    mocks.employeeFindMany.mockResolvedValue([
      { employeeId: 'EMP-001', basicSalary: 26000, currentSalary: 26000 },
    ]);

    mocks.leaveFindMany.mockResolvedValue([]);

    // No attendance records yet (all future dates)
    mocks.attendanceFindMany.mockResolvedValue([]);

    // Has schedules for future dates
    mocks.scheduleFindMany.mockResolvedValue([
      {
        id: 'sched-1',
        employeeId: 'EMP-001',
        date: '2025-11-03',
        startTime: '08:00',
        endTime: '17:00',
        shiftType: 'full-day',
      },
      {
        id: 'sched-2',
        employeeId: 'EMP-001',
        date: '2025-11-04',
        startTime: '08:00',
        endTime: '17:00',
        shiftType: 'full-day',
      },
      {
        id: 'sched-3',
        employeeId: 'EMP-001',
        date: '2025-11-05',
        startTime: '08:00',
        endTime: '17:00',
        shiftType: 'full-day',
      },
    ]);

    try {
      const result = await syncPayrollAttendanceDeductions([payroll]);

      // Should not count future scheduled days as absences
      expect(mocks.payrollUpdate).not.toHaveBeenCalled();
      expect(mocks.transaction).not.toHaveBeenCalled();

      const [unchanged] = result;
      expect(unchanged.absentsLates).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
