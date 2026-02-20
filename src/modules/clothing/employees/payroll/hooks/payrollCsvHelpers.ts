import type { Payroll } from '../types';

type ResolvedEmployee = {
  employeeId?: string | null;
  name?: string | null;
};

type ResolveEmployeeRecord = (
  identifier: string | undefined | null
) => ResolvedEmployee | undefined;

const parseNumber = (value: string | undefined) => {
  const parsed = parseFloat((value ?? '').trim() || '0');
  return Number.isFinite(parsed) ? parsed : 0;
};

export const parsePayrollImportRows = (
  text: string,
  resolveEmployeeRecord: ResolveEmployeeRecord
) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return { payload: [], unmatchedEmployees: [] as string[] };
  }

  const [, ...rows] = lines;
  const unmatchedEmployees = new Set<string>();

  const payload = rows.map((row) => {
    const columns = row.split(',');
    const employee = columns[0]?.trim() ?? '';
    const payPeriod = columns[1]?.trim() ?? '';
    const [periodStart = '', periodEnd = ''] = payPeriod
      .split(' to ')
      .map((value) => value.trim());

    const employeeRecord = resolveEmployeeRecord(employee);
    const status = columns[18]?.trim().toLowerCase() || 'pending';

    if (!employeeRecord) {
      unmatchedEmployees.add(employee);
    }

    return {
      employeeId: employeeRecord?.employeeId,
      employeeName: employeeRecord?.name ?? employee,
      payPeriod,
      periodStart,
      periodEnd,
      basicSalary: parseNumber(columns[2]),
      allowance: parseNumber(columns[3]),
      overtime: parseNumber(columns[4]),
      bonuses: parseNumber(columns[5]),
      thirteenthMonth: parseNumber(columns[6]),
      grossPay: parseNumber(columns[7]),
      sss: parseNumber(columns[8]),
      philHealth: parseNumber(columns[9]),
      pagIbig: parseNumber(columns[10]),
      tax: parseNumber(columns[11]),
      loans: parseNumber(columns[12]),
      cashAdvance: parseNumber(columns[13]),
      lwop: parseNumber(columns[14]),
      absentsLates: parseNumber(columns[15]),
      totalDeductions: parseNumber(columns[16]),
      netPay: parseNumber(columns[17]),
      status,
      bankGcash: columns[19]?.trim() ?? '',
    };
  });

  return {
    payload,
    unmatchedEmployees: Array.from(unmatchedEmployees),
  };
};

export const buildPayrollExportCsv = (payrolls: Payroll[]) => {
  const headers = [
    'Employee',
    'Pay Period',
    'Basic Salary',
    'Allowance',
    'Overtime',
    'Bonuses',
    'Gross Pay',
    'SSS',
    'PhilHealth',
    'Pag-IBIG',
    'Tax',
    'Loans',
    'Cash Advance',
    'LWOP',
    'Absences/Lates',
    'Total Deductions',
    'Net Pay',
    'Status',
    'Bank/GCash',
  ];

  const rows = payrolls.map((payroll) => [
    payroll.employee,
    payroll.payPeriod,
    payroll.basicSalary.toString(),
    payroll.allowance.toString(),
    payroll.overtime.toString(),
    payroll.bonuses.toString(),
    payroll.grossPay.toString(),
    payroll.sss.toString(),
    payroll.philHealth.toString(),
    payroll.pagIbig.toString(),
    payroll.tax.toString(),
    payroll.loans.toString(),
    payroll.cashAdvance.toString(),
    payroll.lwop.toString(),
    payroll.absentsLates.toString(),
    payroll.totalDeductions.toString(),
    payroll.netPay.toString(),
    payroll.status,
    payroll.bankGcash,
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
};
