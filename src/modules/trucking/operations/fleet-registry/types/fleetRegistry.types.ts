export type FleetStatus = 'active' | 'maintenance' | 'inactive' | 'retired';

export interface FleetRegistryRecord {
  id: string;
  truckId: string;
  maker: string;
  model: string;
  year: number;
  plateNo: string;
  bodyNo: string;
  chassisNo: string;
  orCrInfo: string;
  ltoRegisterDate: string; // ISO date
  engineNo: string;
  capacity: string;
  fuelType: string;
  status: FleetStatus;
  remarks?: string;
}

export interface FleetRegistrySummary {
  totalCount: number;
  filteredCount: number;
  activeCount: number;
  maintenanceCount: number;
}

export interface FleetRegistryStats {
  activeUnits: number;
  inMaintenance: number;
  registeredThisYear: number;
  retiredUnits: number;
}
