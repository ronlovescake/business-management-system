export type DashboardViewMode = 'day' | 'month' | 'year';

export type TrendGranularity = 'day' | 'month';

export interface DashboardDepartmentBreakdown {
  name: string;
  count: number;
}

export interface AttendanceTrendPoint {
  key: string;
  label: string;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
}

export interface PayrollTrendPoint {
  key: string;
  label: string;
  gross: number;
  net: number;
  deductions: number;
}

export interface PayrollEarnings {
  basicSalary: number;
  allowance: number;
  overtime: number;
  bonuses: number;
}

export interface PayrollDeductions {
  sss: number;
  philHealth: number;
  pagIbig: number;
  tax: number;
  loans: number;
  lwop: number;
  absentsLates: number;
  cashAdvance: number;
}

export interface LeaveTypeBreakdown {
  type: string;
  requests: number;
  days: number;
}

export interface LeaveRequestSummary {
  id: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
}

export interface OpenCashAdvance {
  id: string;
  employeeName: string;
  amount: number;
  remainingBalance: number;
  monthlyPayment: number;
  status: string;
}

export interface RecentHire {
  name: string;
  position: string;
  department: string;
  hireDate: string;
}

export interface TeamMemberSummary {
  employeeId: string;
  name: string;
  department: string;
  position: string;
  status: string;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  hours: number;
  netPay: number;
  cashAdvanceBalance: number;
}

export interface EmployeeDashboardResponse {
  range: { from: string; to: string };
  attendance: {
    totalRecords: number;
    uniqueEmployees: number;
    statusCounts: Record<string, number>;
    totalHours: number;
    averageHours: number | null;
    attendanceRate: number | null;
    granularity: TrendGranularity;
    trend: AttendanceTrendPoint[];
  };
  payroll: {
    totalGross: number;
    totalNet: number;
    totalDeductions: number;
    totalRecords: number;
    processedCount: number;
    statusCounts: Record<string, number>;
    earnings: PayrollEarnings;
    deductions: PayrollDeductions;
    trend: PayrollTrendPoint[];
  };
  leaves: {
    totalRequests: number;
    totalDays: number;
    statusCounts: Record<string, number>;
    byType: LeaveTypeBreakdown[];
    requests: LeaveRequestSummary[];
  };
  cashAdvance: {
    totalRequested: number;
    totalRecords: number;
    activeCount: number;
    statusCounts: Record<string, number>;
    outstandingBalance: number;
    openBalances: OpenCashAdvance[];
  };
  thirteenthMonth: {
    totalRecords: number;
    totalAccrued: number;
    totalPaid: number;
    statusCounts: Record<string, number>;
  };
  team: {
    headcount: number;
    activeCount: number;
    newHires: number;
    separations: number;
    statusCounts: Record<string, number>;
    employmentStatusCounts: Record<string, number>;
    departments: DashboardDepartmentBreakdown[];
    recentHires: RecentHire[];
  };
  members: TeamMemberSummary[];
}
