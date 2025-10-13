export interface ThirteenthMonthPay {
  id: string;
  employee: string;
  year: string;
  basicSalary: number;
  totalEarnings: number;
  eligibilityMonths: number;
  deductions: number;
  thirteenthMonthPay: number;
  status: 'pending' | 'calculated' | 'approved' | 'paid';
  calculatedDate?: string;
  approvedDate?: string;
  paidDate?: string;
  notes?: string;
}

export interface ThirteenthMonthPayFormData {
  employee: string;
  year: string;
  basicSalary: string;
  totalEarnings: string;
  eligibilityMonths: string;
  deductions: string;
  notes?: string;
}
