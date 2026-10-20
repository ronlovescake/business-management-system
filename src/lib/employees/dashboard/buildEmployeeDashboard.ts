import { sanitizers } from '@/lib/security/sanitize';
import { dayjs } from '@/utils/date';
import type {
  AttendanceTrendPoint,
  EmployeeDashboardResponse,
  PayrollDeductions,
  PayrollEarnings,
  PayrollTrendPoint,
  TeamMemberSummary,
  TrendGranularity,
} from './types';

const DATE_FORMAT = 'YYYY-MM-DD';
const DAILY_TREND_MAX_DAYS = 31;
const LIST_LIMIT = 10;
const RECENT_HIRES_LIMIT = 5;

// Prisma Decimal columns serialize via valueOf/toString, so Number() handles them.
type Numeric = number | string | { toString(): string } | null | undefined;

export type DashboardRange = {
  from: string;
  to: string;
  fromDateTime: Date;
  toDateTime: Date;
};

export type AttendanceRow = {
  employeeId: string;
  employeeName: string;
  department: string;
  date: string;
  status: string;
  totalHours: number | null;
};

export type PayrollRow = {
  employeeId: string;
  employeeName: string;
  periodStart: string;
  status: string;
  basicSalary: number;
  allowance: number;
  overtime: number;
  bonuses: number;
  grossPay: number;
  sss: number;
  philHealth: number;
  pagIbig: number;
  tax: number;
  loans: number;
  lwop: number;
  absentsLates: number;
  cashAdvance: number;
  totalDeductions: number;
  netPay: number;
};

export type LeaveRow = {
  id: number | string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  status: string;
};

export type CashAdvanceRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: Numeric;
  remainingBalance: Numeric;
  monthlyPayment: Numeric;
  status: string;
};

export type ThirteenthMonthRow = {
  thirteenthMonthPay: Numeric;
  status: string;
};

export type EmployeeRow = {
  employeeId: string;
  name: string;
  department: string;
  position: string;
  status: string;
  employmentStatus: string | null;
  hireDate: string;
  employmentEndDate: string | null;
};

export type EmployeeDashboardInput = {
  attendance: AttendanceRow[];
  payroll: PayrollRow[];
  leaves: LeaveRow[];
  cashAdvancesInRange: CashAdvanceRow[];
  openCashAdvances: CashAdvanceRow[];
  thirteenthMonth: ThirteenthMonthRow[];
  employees: EmployeeRow[];
};

const CLOSED_CASH_ADVANCE_STATUSES = ['settled', 'rejected'];

const num = (value: Numeric): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const increment = (map: Record<string, number>, key: string, by = 1) => {
  map[key] = (map[key] ?? 0) + by;
};

const inRange = (value: string | null | undefined, range: DashboardRange) => {
  const date = sanitizers.date(value);
  return Boolean(date) && date >= range.from && date <= range.to;
};

export function getDashboardRange(params: URLSearchParams): DashboardRange {
  const fromParam = sanitizers.date(params.get('from'));
  const toParam = sanitizers.date(params.get('to'));
  const today = dayjs().tz();
  let from = fromParam || today.startOf('month').format(DATE_FORMAT);
  let to = toParam || today.format(DATE_FORMAT);

  if (from > to) {
    [from, to] = [to, from];
  }

  return {
    from,
    to,
    fromDateTime: dayjs(from).tz().startOf('day').toDate(),
    toDateTime: dayjs(to).tz().endOf('day').toDate(),
  };
}

// Plain where-clauses shared by the Clothing and General Merchandise models (identical shapes).
export function getDashboardFilters(range: DashboardRange) {
  const startYear = dayjs(range.from).year();
  const endYear = dayjs(range.to).year();

  return {
    attendance: {
      deletedAt: null,
      date: { gte: range.from, lte: range.to },
    },
    payroll: {
      deletedAt: null,
      periodStart: { gte: range.from, lte: range.to },
    },
    leaves: {
      deletedAt: null,
      startDate: { lte: range.to },
      endDate: { gte: range.from },
    },
    cashAdvancesInRange: {
      deletedAt: null,
      OR: [
        { requestDate: { gte: range.fromDateTime, lte: range.toDateTime } },
        {
          requestDate: null,
          createdAt: { gte: range.fromDateTime, lte: range.toDateTime },
        },
      ],
    },
    openCashAdvances: {
      deletedAt: null,
      status: { notIn: CLOSED_CASH_ADVANCE_STATUSES },
      remainingBalance: { gt: 0 },
    },
    thirteenthMonth: { year: { gte: startYear, lte: endYear } },
    employees: { deletedAt: null },
  };
}

export const DASHBOARD_SELECTS = {
  attendance: {
    employeeId: true,
    employeeName: true,
    department: true,
    date: true,
    status: true,
    totalHours: true,
  },
  payroll: {
    employeeId: true,
    employeeName: true,
    periodStart: true,
    status: true,
    basicSalary: true,
    allowance: true,
    overtime: true,
    bonuses: true,
    grossPay: true,
    sss: true,
    philHealth: true,
    pagIbig: true,
    tax: true,
    loans: true,
    lwop: true,
    absentsLates: true,
    cashAdvance: true,
    totalDeductions: true,
    netPay: true,
  },
  leaves: {
    id: true,
    employeeName: true,
    leaveType: true,
    startDate: true,
    endDate: true,
    numberOfDays: true,
    status: true,
  },
  cashAdvances: {
    id: true,
    employeeId: true,
    employeeName: true,
    amount: true,
    remainingBalance: true,
    monthlyPayment: true,
    status: true,
  },
  thirteenthMonth: { thirteenthMonthPay: true, status: true },
  employees: {
    employeeId: true,
    name: true,
    department: true,
    position: true,
    status: true,
    employmentStatus: true,
    hireDate: true,
    employmentEndDate: true,
  },
} as const;

function buildBuckets(range: DashboardRange) {
  const start = dayjs(range.from);
  const end = dayjs(range.to);
  const granularity: TrendGranularity =
    end.diff(start, 'day') + 1 <= DAILY_TREND_MAX_DAYS ? 'day' : 'month';
  const spansYears = start.year() !== end.year();
  const buckets: Array<{ key: string; label: string }> = [];

  if (granularity === 'day') {
    for (let d = start; !d.isAfter(end, 'day'); d = d.add(1, 'day')) {
      buckets.push({ key: d.format(DATE_FORMAT), label: d.format('MMM D') });
    }
  } else {
    for (
      let m = start.startOf('month');
      !m.isAfter(end, 'month');
      m = m.add(1, 'month')
    ) {
      buckets.push({
        key: m.format('YYYY-MM'),
        label: m.format(spansYears ? "MMM 'YY" : 'MMM'),
      });
    }
  }

  const keyOf = (date: string) => {
    const normalized = sanitizers.date(date);
    if (!normalized) {
      return null;
    }
    return granularity === 'day' ? normalized : normalized.slice(0, 7);
  };

  return { granularity, buckets, keyOf };
}

const emptyMember = (
  employeeId: string,
  name: string,
  department: string,
  position = '',
  status = ''
): TeamMemberSummary => ({
  employeeId,
  name,
  department,
  position,
  status,
  present: 0,
  late: 0,
  absent: 0,
  onLeave: 0,
  hours: 0,
  netPay: 0,
  cashAdvanceBalance: 0,
});

export function buildEmployeeDashboard(
  input: EmployeeDashboardInput,
  range: DashboardRange
): EmployeeDashboardResponse {
  const { granularity, buckets, keyOf } = buildBuckets(range);

  const members = new Map<string, TeamMemberSummary>();
  const activeIds = new Set<string>();
  for (const employee of input.employees) {
    members.set(
      employee.employeeId,
      emptyMember(
        employee.employeeId,
        employee.name,
        employee.department || 'Unassigned',
        employee.position,
        (employee.status || 'unknown').toLowerCase()
      )
    );
    if ((employee.status || '').toLowerCase() === 'active') {
      activeIds.add(employee.employeeId);
    }
  }
  const memberFor = (id: string, name: string, department = '') => {
    const existing = members.get(id);
    if (existing) {
      return existing;
    }
    const created = emptyMember(id, name, department || 'Unassigned');
    members.set(id, created);
    return created;
  };
  const involvedIds = new Set<string>(activeIds);

  // Attendance
  const attendanceStatusCounts: Record<string, number> = {};
  const attendanceTrend = new Map<string, AttendanceTrendPoint>(
    buckets.map((bucket) => [
      bucket.key,
      { ...bucket, present: 0, late: 0, absent: 0, onLeave: 0 },
    ])
  );
  const attendanceEmployees = new Set<string>();
  let totalHours = 0;
  for (const row of input.attendance) {
    const status = row.status.toLowerCase();
    increment(attendanceStatusCounts, row.status);
    attendanceEmployees.add(row.employeeId);
    involvedIds.add(row.employeeId);
    const hours = num(row.totalHours);
    totalHours += hours;

    const member = memberFor(row.employeeId, row.employeeName, row.department);
    member.hours += hours;
    const point = attendanceTrend.get(keyOf(row.date) ?? '');
    const field =
      status === 'present'
        ? 'present'
        : status === 'late'
          ? 'late'
          : status === 'absent'
            ? 'absent'
            : status === 'on-leave'
              ? 'onLeave'
              : null;
    if (field) {
      member[field] += 1;
      if (point) {
        point[field] += 1;
      }
    }
  }
  const attendedCount = Object.entries(attendanceStatusCounts)
    .filter(([status]) => ['present', 'late'].includes(status.toLowerCase()))
    .reduce((sum, [, count]) => sum + count, 0);

  // Payroll
  const payrollStatusCounts: Record<string, number> = {};
  const earnings: PayrollEarnings = {
    basicSalary: 0,
    allowance: 0,
    overtime: 0,
    bonuses: 0,
  };
  const deductions: PayrollDeductions = {
    sss: 0,
    philHealth: 0,
    pagIbig: 0,
    tax: 0,
    loans: 0,
    lwop: 0,
    absentsLates: 0,
    cashAdvance: 0,
  };
  const payrollTrend = new Map<string, PayrollTrendPoint>(
    buckets.map((bucket) => [
      bucket.key,
      { ...bucket, gross: 0, net: 0, deductions: 0 },
    ])
  );
  let totalGross = 0;
  let totalNet = 0;
  let totalDeductions = 0;
  for (const row of input.payroll) {
    increment(payrollStatusCounts, row.status);
    totalGross += num(row.grossPay);
    totalNet += num(row.netPay);
    totalDeductions += num(row.totalDeductions);
    (Object.keys(earnings) as Array<keyof PayrollEarnings>).forEach((key) => {
      earnings[key] += num(row[key]);
    });
    (Object.keys(deductions) as Array<keyof PayrollDeductions>).forEach(
      (key) => {
        deductions[key] += num(row[key]);
      }
    );
    const point = payrollTrend.get(keyOf(row.periodStart) ?? '');
    if (point) {
      point.gross += num(row.grossPay);
      point.net += num(row.netPay);
      point.deductions += num(row.totalDeductions);
    }
    involvedIds.add(row.employeeId);
    memberFor(row.employeeId, row.employeeName).netPay += num(row.netPay);
  }

  // Leaves
  const leaveStatusCounts: Record<string, number> = {};
  const leaveTypes = new Map<string, { requests: number; days: number }>();
  let leaveDays = 0;
  for (const row of input.leaves) {
    increment(leaveStatusCounts, row.status);
    const days = num(row.numberOfDays);
    leaveDays += days;
    const type = row.leaveType || 'Other';
    const current = leaveTypes.get(type) ?? { requests: 0, days: 0 };
    leaveTypes.set(type, {
      requests: current.requests + 1,
      days: current.days + days,
    });
  }

  // Cash advances
  const cashAdvanceStatusCounts: Record<string, number> = {};
  let totalRequested = 0;
  for (const row of input.cashAdvancesInRange) {
    increment(cashAdvanceStatusCounts, row.status);
    totalRequested += num(row.amount);
  }
  const cashAdvanceActive = Object.entries(cashAdvanceStatusCounts)
    .filter(
      ([status]) => !CLOSED_CASH_ADVANCE_STATUSES.includes(status.toLowerCase())
    )
    .reduce((sum, [, count]) => sum + count, 0);
  let outstandingBalance = 0;
  for (const row of input.openCashAdvances) {
    const remaining = num(row.remainingBalance);
    outstandingBalance += remaining;
    const member = members.get(row.employeeId);
    if (member) {
      member.cashAdvanceBalance += remaining;
      involvedIds.add(row.employeeId);
    }
  }

  // 13th month
  const thirteenthStatusCounts: Record<string, number> = {};
  let thirteenthAccrued = 0;
  let thirteenthPaid = 0;
  for (const row of input.thirteenthMonth) {
    increment(thirteenthStatusCounts, row.status);
    const amount = num(row.thirteenthMonthPay);
    thirteenthAccrued += amount;
    if (row.status.toLowerCase() === 'paid') {
      thirteenthPaid += amount;
    }
  }

  // Team
  const teamStatusCounts: Record<string, number> = {};
  const employmentStatusCounts: Record<string, number> = {};
  const departmentCounts: Record<string, number> = {};
  const hires: EmployeeRow[] = [];
  let separations = 0;
  for (const employee of input.employees) {
    increment(teamStatusCounts, (employee.status || 'unknown').toLowerCase());
    if (employee.employmentStatus) {
      increment(employmentStatusCounts, employee.employmentStatus);
    }
    if ((employee.status || '').toLowerCase() === 'active') {
      increment(departmentCounts, employee.department || 'Unassigned');
    }
    if (inRange(employee.hireDate, range)) {
      hires.push(employee);
    }
    if (inRange(employee.employmentEndDate, range)) {
      separations += 1;
    }
  }

  return {
    range: { from: range.from, to: range.to },
    attendance: {
      totalRecords: input.attendance.length,
      uniqueEmployees: attendanceEmployees.size,
      statusCounts: attendanceStatusCounts,
      totalHours: round2(totalHours),
      averageHours:
        input.attendance.length > 0
          ? round2(totalHours / input.attendance.length)
          : null,
      attendanceRate:
        input.attendance.length > 0
          ? round2((attendedCount / input.attendance.length) * 100)
          : null,
      granularity,
      trend: Array.from(attendanceTrend.values()),
    },
    payroll: {
      totalGross: round2(totalGross),
      totalNet: round2(totalNet),
      totalDeductions: round2(totalDeductions),
      totalRecords: input.payroll.length,
      processedCount: input.payroll.filter(
        (row) => row.status.toLowerCase() !== 'pending'
      ).length,
      statusCounts: payrollStatusCounts,
      earnings,
      deductions,
      trend: Array.from(payrollTrend.values()),
    },
    leaves: {
      totalRequests: input.leaves.length,
      totalDays: leaveDays,
      statusCounts: leaveStatusCounts,
      byType: Array.from(leaveTypes.entries())
        .map(([type, value]) => ({ type, ...value }))
        .sort((a, b) => b.requests - a.requests),
      requests: [...input.leaves]
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .slice(0, LIST_LIMIT)
        .map((row) => ({
          id: String(row.id),
          employeeName: row.employeeName,
          leaveType: row.leaveType,
          startDate: row.startDate,
          endDate: row.endDate,
          days: num(row.numberOfDays),
          status: row.status,
        })),
    },
    cashAdvance: {
      totalRequested: round2(totalRequested),
      totalRecords: input.cashAdvancesInRange.length,
      activeCount: cashAdvanceActive,
      statusCounts: cashAdvanceStatusCounts,
      outstandingBalance: round2(outstandingBalance),
      openBalances: input.openCashAdvances
        .map((row) => ({
          id: row.id,
          employeeName: row.employeeName,
          amount: num(row.amount),
          remainingBalance: num(row.remainingBalance),
          monthlyPayment: num(row.monthlyPayment),
          status: row.status,
        }))
        .sort((a, b) => b.remainingBalance - a.remainingBalance)
        .slice(0, LIST_LIMIT),
    },
    thirteenthMonth: {
      totalRecords: input.thirteenthMonth.length,
      totalAccrued: round2(thirteenthAccrued),
      totalPaid: round2(thirteenthPaid),
      statusCounts: thirteenthStatusCounts,
    },
    team: {
      headcount: input.employees.length,
      activeCount: activeIds.size,
      newHires: hires.length,
      separations,
      statusCounts: teamStatusCounts,
      employmentStatusCounts,
      departments: Object.entries(departmentCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      recentHires: hires
        .sort((a, b) =>
          sanitizers.date(b.hireDate).localeCompare(sanitizers.date(a.hireDate))
        )
        .slice(0, RECENT_HIRES_LIMIT)
        .map((employee) => ({
          name: employee.name,
          position: employee.position,
          department: employee.department,
          hireDate: sanitizers.date(employee.hireDate),
        })),
    },
    members: Array.from(members.values())
      .filter((member) => involvedIds.has(member.employeeId))
      .map((member) => ({
        ...member,
        hours: round2(member.hours),
        netPay: round2(member.netPay),
        cashAdvanceBalance: round2(member.cashAdvanceBalance),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
