export interface ThirteenthMonthPay {
  id: string;
  employee: string;
  year: string;
  hireDate?: string | null;
  tenureship?: string;
  totalBasicSalary: number;
  totalLwop: number;
  totalAbsencesLates: number;
  netBasicSalary: number;
  monthsWorked?: number;
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
  totalBasicSalary: string;
  totalLwop: string;
  totalAbsencesLates: string;
  notes?: string;
}
