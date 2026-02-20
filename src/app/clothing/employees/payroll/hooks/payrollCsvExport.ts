import { getCurrentDateISO } from '@/utils/date';
import type { Payroll } from '../types';

export function exportPayrollCsv(payrolls: Payroll[]): void {
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

  const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join(
    '\n'
  );
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `payroll-${getCurrentDateISO()}.csv`;
  link.click();
}
