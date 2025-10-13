export interface Payroll {
  id: string;
  employee: string;
  payPeriod: string;
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
  others: number;
  totalDeductions: number;
  netPay: number;
  status: 'pending' | 'approved' | 'paid';
  bankGcash: string;
  approvedBy?: string;
  approvedDate?: string;
  paidDate?: string;
}

export interface PayrollFormData {
  employee: string;
  payPeriod: string;
  basicSalary: string;
  allowance: string;
  overtime: string;
  bonuses: string;
  sss: string;
  philHealth: string;
  pagIbig: string;
  tax: string;
  loans: string;
  others: string;
  bankGcash: string;
}
