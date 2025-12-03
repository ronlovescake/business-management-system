export type DueStatus = 'due-today' | 'past-due' | null;

export interface DueDateGridRow {
  id: string;
  customer: string;
  productCode: string;
  quantity: number | string | null;
  unitPrice: number | string | null;
  lineTotal: number | string | null;
  invoiceDate: string;
  dueDate: string;
  dueIn: string;
  dueInHours: number;
  dueStatus: DueStatus;
  notes: string;
  done: string;
}
