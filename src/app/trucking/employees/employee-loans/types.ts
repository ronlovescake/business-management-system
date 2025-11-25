export interface EmployeeLoan {
  id: string;
  employee: string;
  loanType: 'personal' | 'emergency' | 'educational' | 'housing' | 'vehicle';
  amount: number;
  interestRate: number; // percentage
  termMonths: number;
  monthlyPayment: number;
  remainingBalance: number;
  status: 'pending' | 'approved' | 'active' | 'completed' | 'rejected';
  applicationDate: string;
  purpose: string;
  approvedBy?: string;
  approvedDate?: string;
  rejectedBy?: string;
  rejectedDate?: string;
  rejectionReason?: string;
  notes?: string;
}

export interface EmployeeLoanFormData {
  employee: string;
  loanType: string;
  amount: string;
  interestRate: string;
  termMonths: string;
  applicationDate: string;
  purpose: string;
  notes?: string;
}
