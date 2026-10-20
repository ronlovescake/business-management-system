import { describe, expect, it } from 'vitest';
import {
  buildEmployeeDashboard,
  getDashboardRange,
  type EmployeeDashboardInput,
  type PayrollRow,
} from '../buildEmployeeDashboard';

const payroll = (overrides: Partial<PayrollRow>): PayrollRow => ({
  employeeId: 'E1',
  employeeName: 'Ana Cruz',
  periodStart: '2026-10-01',
  status: 'paid',
  basicSalary: 10000,
  allowance: 500,
  overtime: 0,
  bonuses: 0,
  grossPay: 10500,
  sss: 450,
  philHealth: 250,
  pagIbig: 100,
  tax: 0,
  loans: 0,
  lwop: 0,
  absentsLates: 200,
  cashAdvance: 1000,
  totalDeductions: 2000,
  netPay: 8500,
  ...overrides,
});

const baseInput = (): EmployeeDashboardInput => ({
  attendance: [
    {
      employeeId: 'E1',
      employeeName: 'Ana Cruz',
      department: 'Operations',
      date: '2026-10-01',
      status: 'present',
      totalHours: 8,
    },
    {
      employeeId: 'E1',
      employeeName: 'Ana Cruz',
      department: 'Operations',
      date: '2026-10-02',
      status: 'late',
      totalHours: 7.5,
    },
    {
      employeeId: 'E2',
      employeeName: 'Ben Dela',
      department: 'Warehouse',
      date: '2026-10-02',
      status: 'absent',
      totalHours: 0,
    },
    {
      employeeId: 'E2',
      employeeName: 'Ben Dela',
      department: 'Warehouse',
      date: '2026-10-03',
      status: 'on-leave',
      totalHours: 0,
    },
  ],
  payroll: [
    payroll({}),
    payroll({
      employeeId: 'E2',
      employeeName: 'Ben Dela',
      status: 'pending',
      periodStart: '2026-10-16',
      grossPay: 9000,
      netPay: 8000,
      totalDeductions: 1000,
      cashAdvance: 0,
    }),
  ],
  leaves: [
    {
      id: 1,
      employeeName: 'Ben Dela',
      leaveType: 'Sick',
      startDate: '2026-10-03',
      endDate: '2026-10-04',
      numberOfDays: 2,
      status: 'approved',
    },
    {
      id: 2,
      employeeName: 'Ana Cruz',
      leaveType: 'Vacation',
      startDate: '2026-10-20',
      endDate: '2026-10-20',
      numberOfDays: 1,
      status: 'pending',
    },
  ],
  cashAdvancesInRange: [
    {
      id: 'ca-1',
      employeeId: 'E1',
      employeeName: 'Ana Cruz',
      amount: 3000,
      remainingBalance: 2000,
      monthlyPayment: 1000,
      status: 'approved',
    },
    {
      id: 'ca-2',
      employeeId: 'E2',
      employeeName: 'Ben Dela',
      amount: 500,
      remainingBalance: 0,
      monthlyPayment: null,
      status: 'rejected',
    },
  ],
  openCashAdvances: [
    {
      id: 'ca-1',
      employeeId: 'E1',
      employeeName: 'Ana Cruz',
      amount: 3000,
      remainingBalance: 2000,
      monthlyPayment: 1000,
      status: 'approved',
    },
    {
      id: 'ca-3',
      employeeId: 'E3',
      employeeName: 'Cara Lim',
      amount: 5000,
      remainingBalance: '4500.00',
      monthlyPayment: 500,
      status: 'approved',
    },
  ],
  thirteenthMonth: [
    { thirteenthMonthPay: 1000, status: 'paid' },
    { thirteenthMonthPay: '500', status: 'calculated' },
  ],
  employees: [
    {
      employeeId: 'E1',
      name: 'Ana Cruz',
      department: 'Operations',
      position: 'Packer',
      status: 'active',
      employmentStatus: 'Regular',
      hireDate: '2026-10-05',
      employmentEndDate: null,
    },
    {
      employeeId: 'E2',
      name: 'Ben Dela',
      department: 'Warehouse',
      position: 'Picker',
      status: 'active',
      employmentStatus: 'Probationary',
      hireDate: '2025-01-10',
      employmentEndDate: null,
    },
    {
      employeeId: 'E3',
      name: 'Cara Lim',
      department: 'Operations',
      position: 'Driver',
      status: 'terminated',
      employmentStatus: 'Regular',
      hireDate: '2024-03-01',
      employmentEndDate: '2026-10-15',
    },
    {
      employeeId: 'E4',
      name: 'Dan Uy',
      department: 'Operations',
      position: 'Helper',
      status: 'terminated',
      employmentStatus: null,
      hireDate: '2023-03-01',
      employmentEndDate: '2025-01-01',
    },
  ],
});

const OCTOBER = getDashboardRange(
  new URLSearchParams({ from: '2026-10-31', to: '2026-10-01' })
);

describe('buildEmployeeDashboard', () => {
  it('normalizes reversed ranges', () => {
    expect(OCTOBER.from).toBe('2026-10-01');
    expect(OCTOBER.to).toBe('2026-10-31');
  });

  it('summarizes attendance with daily trend buckets for a month', () => {
    const { attendance } = buildEmployeeDashboard(baseInput(), OCTOBER);

    expect(attendance.totalRecords).toBe(4);
    expect(attendance.uniqueEmployees).toBe(2);
    expect(attendance.totalHours).toBe(15.5);
    expect(attendance.attendanceRate).toBe(50);
    expect(attendance.granularity).toBe('day');
    expect(attendance.trend).toHaveLength(31);
    expect(attendance.trend[1]).toMatchObject({
      key: '2026-10-02',
      late: 1,
      absent: 1,
    });
  });

  it('uses monthly buckets for a year range', () => {
    const year = getDashboardRange(
      new URLSearchParams({ from: '2026-01-01', to: '2026-12-31' })
    );
    const { attendance, payroll: payrollSummary } = buildEmployeeDashboard(
      baseInput(),
      year
    );

    expect(attendance.granularity).toBe('month');
    expect(attendance.trend).toHaveLength(12);
    expect(attendance.trend[9]).toMatchObject({
      key: '2026-10',
      present: 1,
      late: 1,
      absent: 1,
      onLeave: 1,
    });
    expect(payrollSummary.trend[9]).toMatchObject({ gross: 19500, net: 16500 });
  });

  it('breaks down payroll earnings and deductions', () => {
    const { payroll: summary } = buildEmployeeDashboard(baseInput(), OCTOBER);

    expect(summary.totalNet).toBe(16500);
    expect(summary.processedCount).toBe(1);
    expect(summary.earnings.basicSalary).toBe(20000);
    expect(summary.deductions.cashAdvance).toBe(1000);
    expect(summary.deductions.sss).toBe(900);
  });

  it('groups leaves by type and sorts requests by start date', () => {
    const { leaves } = buildEmployeeDashboard(baseInput(), OCTOBER);

    expect(leaves.totalDays).toBe(3);
    expect(leaves.byType).toEqual([
      { type: 'Sick', requests: 1, days: 2 },
      { type: 'Vacation', requests: 1, days: 1 },
    ]);
    expect(leaves.requests[0].employeeName).toBe('Ben Dela');
  });

  it('reports open cash-advance balances independent of the range', () => {
    const { cashAdvance } = buildEmployeeDashboard(baseInput(), OCTOBER);

    expect(cashAdvance.totalRequested).toBe(3500);
    expect(cashAdvance.activeCount).toBe(1);
    expect(cashAdvance.outstandingBalance).toBe(6500);
    expect(cashAdvance.openBalances[0]).toMatchObject({
      employeeName: 'Cara Lim',
      remainingBalance: 4500,
    });
  });

  it('summarizes team and 13th month pay without expenses', () => {
    const result = buildEmployeeDashboard(baseInput(), OCTOBER);

    expect(result.team).toMatchObject({
      headcount: 4,
      activeCount: 2,
      newHires: 1,
      separations: 1,
      statusCounts: { active: 2, terminated: 2 },
      employmentStatusCounts: { Regular: 2, Probationary: 1 },
    });
    expect(result.team.departments).toEqual([
      { name: 'Operations', count: 1 },
      { name: 'Warehouse', count: 1 },
    ]);
    expect(result.team.recentHires[0].name).toBe('Ana Cruz');
    expect(result).not.toHaveProperty('expenses');
    expect(result.thirteenthMonth).toMatchObject({
      totalAccrued: 1500,
      totalPaid: 1000,
    });
  });

  it('builds per-member summaries for active and involved employees only', () => {
    const { members } = buildEmployeeDashboard(baseInput(), OCTOBER);

    expect(members.map((m) => m.employeeId)).toEqual(['E1', 'E2', 'E3']);
    expect(members[0]).toMatchObject({
      present: 1,
      late: 1,
      hours: 15.5,
      netPay: 8500,
      cashAdvanceBalance: 2000,
    });
    expect(members[1]).toMatchObject({ absent: 1, onLeave: 1, netPay: 8000 });
  });
});
