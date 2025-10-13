export interface CashAdvance {
  id: string;
  employee: string;
  amount: number;
  purpose: string;
  terms: string;
  requestDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  notes?: string;
  approvedBy?: string;
  approvedDate?: string;
  rejectedBy?: string;
  rejectedDate?: string;
  rejectionReason?: string;
}

export interface CashAdvanceFormData {
  employee: string;
  amount: string;
  purpose: string;
  terms: string;
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
