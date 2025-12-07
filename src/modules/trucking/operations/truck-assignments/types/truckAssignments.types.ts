export type TruckAssignmentStatus =
  | 'scheduled'
  | 'active'
  | 'completed'
  | 'cancelled';

export interface TruckAssignmentRecord {
  id: string;
  truckId: string;
  plateNo: string;
  driver: string;
  helper: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  status: TruckAssignmentStatus;
  route?: string;
  notes?: string;
}

export interface TruckAssignmentSummary {
  totalCount: number;
  filteredCount: number;
  filteredActiveCount: number;
  filteredScheduledCount: number;
  filteredEndingSoonCount: number;
}

export interface TruckAssignmentStats {
  activeCount: number;
  scheduledThisWeek: number;
  endingSoon: number;
  completedThisMonth: number;
}
