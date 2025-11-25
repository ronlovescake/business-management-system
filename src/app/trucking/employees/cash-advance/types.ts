export type CashAdvanceStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export type CashAdvanceCycle = 'FIRST_HALF' | 'SECOND_HALF';

export interface CashAdvance {
  id: string;
  employeeId: string;
  employee: string;
  amount: number;
  purpose: string;
  terms: string;
  termsMonths?: number | null;
  requestDate: string;
  status: CashAdvanceStatus;
  notes?: string;
  approvedBy?: string;
  approvedDate?: string;
  rejectedBy?: string;
  rejectedDate?: string;
  rejectionReason?: string;
  monthlyPayment?: number;
  remainingBalance?: number;
  settledAmount?: number;
  createdAt?: string;
  updatedAt?: string;
  deductionCycle?: CashAdvanceCycle;
  nextDeductionDate?: string | null;
  lastDeductedDate?: string | null;
}

export interface CashAdvanceFormData {
  employee: string;
  amount: string;
  purpose: string;
  terms: string;
  monthlyPayment: string;
  requestDate: string;
  notes?: string;
}

export interface CashAdvanceStats {
  icon: React.ReactNode;
  title: string;
  value: string;
  description: string;
  color: string;
}
