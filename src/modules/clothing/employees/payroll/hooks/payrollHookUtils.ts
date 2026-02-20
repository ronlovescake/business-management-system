import type { Payroll } from '../types';

export interface EmployeeDirectoryEntry {
  id: string;
  employeeId: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  sssMonthlyContribution?: number | null;
  philHealthMonthlyContribution?: number | null;
  pagibigMonthlyContribution?: number | null;
  taxMonthlyContribution?: number | null;
}

export const normalizeIdentifier = (value: string | undefined | null) =>
  (value ?? '').toString().trim().replace(/\s+/g, ' ').toLowerCase();

const toOptionalNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object' && 'toString' in (value as object)) {
    const parsed = parseFloat((value as { toString(): string }).toString());
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export const mapEmployeeDirectoryEntries = (
  data: unknown
): EmployeeDirectoryEntry[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((item: unknown) => {
    const record = item as Record<string, unknown>;
    return {
      id:
        record.id !== undefined && record.id !== null ? String(record.id) : '',
      employeeId: String(record.employeeId ?? ''),
      name:
        typeof record.name === 'string'
          ? record.name
          : `${String(record.firstName ?? '')} ${String(record.lastName ?? '')}`,
      firstName: typeof record.firstName === 'string' ? record.firstName : null,
      lastName: typeof record.lastName === 'string' ? record.lastName : null,
      sssMonthlyContribution:
        toOptionalNumber(record.sssMonthlyContribution) ?? null,
      philHealthMonthlyContribution:
        toOptionalNumber(record.philHealthMonthlyContribution) ?? null,
      pagibigMonthlyContribution:
        toOptionalNumber(record.pagibigMonthlyContribution) ?? null,
      taxMonthlyContribution:
        toOptionalNumber(record.taxMonthlyContribution) ?? null,
    };
  });
};

export const mapPayrollRecord = (record: Record<string, unknown>): Payroll => {
  const basicSalary = toNumber(record.basicSalary);
  const allowance = toNumber(record.allowance);
  const overtime = toNumber(record.overtime);
  const bonuses = toNumber(record.bonuses);
  const thirteenthMonth = toNumber(record.thirteenthMonth);
  const grossPay = toNumber(record.grossPay);
  const sss = toNumber(record.sss);
  const philHealth = toNumber(record.philHealth);
  const pagIbig = toNumber(record.pagIbig);
  const tax = toNumber(record.tax);
  const loans = toNumber(record.loans);
  const cashAdvance = toNumber(record.cashAdvance);
  const lwop = toNumber(
    record.lwop !== undefined && record.lwop !== null
      ? record.lwop
      : record.deduction
  );
  const absentsLates = toNumber(record.absentsLates);

  const derivedTotalDeductions =
    sss +
    philHealth +
    pagIbig +
    tax +
    loans +
    cashAdvance +
    lwop +
    absentsLates;
  const derivedNetPay = Math.max(0, grossPay - derivedTotalDeductions);

  const totalDeductions = toNumber(record.totalDeductions);
  const netPay = toNumber(record.netPay);

  return {
    id: String(record.id ?? ''),
    employee: String(record.employeeName ?? ''),
    employeeId: record.employeeId ? String(record.employeeId) : null,
    payPeriod: String(record.payPeriod ?? ''),
    basicSalary,
    allowance,
    overtime,
    bonuses,
    grossPay,
    thirteenthMonth,
    sss,
    philHealth,
    pagIbig,
    tax,
    loans,
    cashAdvance,
    lwop,
    absentsLates,
    totalDeductions:
      totalDeductions > 0 ? totalDeductions : derivedTotalDeductions,
    netPay: netPay > 0 ? netPay : derivedNetPay,
    status: record.status as 'pending' | 'approved' | 'paid',
    bankGcash: String(record.bankGcash ?? ''),
    approvedBy:
      typeof record.approvedBy === 'string' ? record.approvedBy : undefined,
    approvedDate:
      typeof record.approvedDate === 'string' ? record.approvedDate : undefined,
    paidDate: typeof record.paidDate === 'string' ? record.paidDate : undefined,
  };
};

export const mapPayrollRecords = (
  data: Array<Record<string, unknown>>
): Payroll[] => data.map(mapPayrollRecord);

export const buildEmployeeOptions = (
  employees: EmployeeDirectoryEntry[]
): string[] => {
  const names = new Set<string>();
  employees.forEach((entry) => {
    const resolvedName = (entry.name || '').trim();
    if (resolvedName) {
      names.add(resolvedName);
      return;
    }

    const fallback = `${entry.firstName ?? ''} ${entry.lastName ?? ''}`.trim();
    if (fallback) {
      names.add(fallback);
    }
  });

  return Array.from(names).sort((a, b) => a.localeCompare(b));
};

export const filterPayrolls = (
  payrolls: Payroll[],
  searchQuery: string,
  statusFilter: string,
  payPeriodFilter: string
): Payroll[] => {
  const normalizedQuery = searchQuery.toLowerCase();
  return payrolls.filter((payroll) => {
    const matchesSearch =
      payroll.employee.toLowerCase().includes(normalizedQuery) ||
      payroll.payPeriod.toLowerCase().includes(normalizedQuery) ||
      payroll.bankGcash.toLowerCase().includes(normalizedQuery);

    const matchesStatus =
      statusFilter === 'all' || payroll.status === statusFilter;

    const matchesPayPeriod =
      payPeriodFilter === 'all' || payroll.payPeriod === payPeriodFilter;

    return matchesSearch && matchesStatus && matchesPayPeriod;
  });
};

export const derivePayrollSummary = (payrolls: Payroll[]) => {
  const totalPayrolls = payrolls.length;
  const pendingPayrolls = payrolls.filter((p) => p.status === 'pending').length;
  const approvedPayrolls = payrolls.filter(
    (p) => p.status === 'approved'
  ).length;
  const totalNetPay = payrolls
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.netPay, 0);

  return {
    totalPayrolls,
    pendingPayrolls,
    approvedPayrolls,
    totalNetPay,
  };
};

export const derivePayPeriods = (payrolls: Payroll[]): string[] => {
  const periods = Array.from(new Set(payrolls.map((p) => p.payPeriod)));
  return ['all', ...periods];
};

export const formatPayrollDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export const formatPayrollCurrency = (amount: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount);

export const getPayrollStatusColor = (status: Payroll['status']) => {
  switch (status) {
    case 'pending':
      return 'orange';
    case 'approved':
      return 'green';
    case 'paid':
      return 'blue';
    default:
      return 'gray';
  }
};
