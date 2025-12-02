export type DashboardViewMode = 'day' | 'month' | 'year';

export interface DashboardCategoryBreakdown {
  category: string;
  amount: number;
}

export interface DashboardDepartmentBreakdown {
  name: string;
  count: number;
}

export interface EmployeeDashboardResponse {
  range: {
    from: string;
    to: string;
  };
  attendance: {
    totalRecords: number;
    uniqueEmployees: number;
    statusCounts: Record<string, number>;
  };
  expenses: {
    totalAmount: number;
    categories: DashboardCategoryBreakdown[];
  };
  payroll: {
    totalGross: number;
    totalNet: number;
    totalDeductions: number;
    totalRecords: number;
    processedCount: number;
    statusCounts: Record<string, number>;
  };
  leaves: {
    totalRequests: number;
    statusCounts: Record<string, number>;
  };
  cashAdvance: {
    totalRequested: number;
    outstandingBalance: number;
    totalRecords: number;
    activeCount: number;
    statusCounts: Record<string, number>;
  };
  thirteenthMonth: {
    totalRecords: number;
    totalAccrued: number;
    totalPaid: number;
    statusCounts: Record<string, number>;
  };
  team: {
    headcount: number;
    newHires: number;
    statusCounts: Record<string, number>;
    departments: DashboardDepartmentBreakdown[];
  };
}
