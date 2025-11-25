export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

export interface Expense {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  notes: string;
  receipt: string | null;
  status: ExpenseStatus;
  employeeName?: string;
}

export interface ImportCSVSummary {
  successCount: number;
  errorCount: number;
  errors: string[];
}
