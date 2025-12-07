export type TemplateStatus =
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'cancelled';

export interface TemplateRecord {
  id: string;
  date: string; // ISO date
  primary: string; // e.g., driver/customer
  secondary: string; // e.g., helper/item
  category: string; // e.g., truck/product line
  metricIn: number; // e.g., revenue
  metricOut: number; // e.g., expenses
  notes: string;
  status: TemplateStatus;
}

export interface TemplateSummary {
  totalCount: number;
  filteredCount: number;
  filteredMetricIn: number;
  filteredMetricOut: number;
  filteredNet: number;
}
