export type VehicleAssignmentStatus =
  | 'scheduled'
  | 'active'
  | 'completed'
  | 'cancelled';

export interface VehicleAssignmentRecord {
  id: string;
  vehicleId: string;
  plateNo: string;
  driver: string;
  helper: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  status: VehicleAssignmentStatus;
  route?: string;
  notes?: string;
}

export interface VehicleAssignmentDraft {
  vehicleId: string;
  plateNo: string;
  driver: string;
  helper: string;
  startDate: string;
  endDate: string;
  status: VehicleAssignmentStatus;
  route?: string;
  notes?: string;
}

export interface VehicleAssignmentVehicleOption {
  vehicleId: string;
  plateNo: string;
  label: string;
}

export interface VehicleAssignmentSummary {
  totalCount: number;
  filteredCount: number;
  filteredActiveCount: number;
  filteredScheduledCount: number;
  filteredEndingSoonCount: number;
}

export interface VehicleAssignmentStats {
  activeCount: number;
  scheduledThisWeek: number;
  endingSoon: number;
  completedThisMonth: number;
}
