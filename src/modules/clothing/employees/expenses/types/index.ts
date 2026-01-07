export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'paid';

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
  sourceType?: string;
  sourceId?: string | null;
  sourceLineKey?: string | null;
  systemGenerated?: boolean;
}

export interface ImportCSVSummary {
  successCount: number;
  errorCount: number;
  errors: string[];
}
