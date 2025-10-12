/**
 * Due Dates Module - Type Definitions
 */

export interface DueDateItem {
  id: string;
  customer: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  invoiceDate: string;
  dueDate: string;
  dueIn: number;
  contactBuyer: string;
}

export interface DueDateFilters {
  searchQuery: string;
  statusFilter: 'all' | 'overdue' | 'due-soon' | 'on-track' | null;
}

export interface DueDateStats {
  overdue: number;
  dueSoon: number;
  onTrack: number;
  total: number;
}
