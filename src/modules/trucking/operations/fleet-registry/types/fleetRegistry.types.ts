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
  passengerCapacity: string;
  grossWeight: string;
  netWeight: string;
  bodyType: string;
  series: string;
  classification: string;
  vehicleType: string;
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

export interface FleetUnitFormValues {
  truckId: string;
  maker: string;
  model: string;
  year: string;
  plateNo: string;
  bodyNo: string;
  chassisNo: string;
  engineNo: string;
  capacity: string;
  passengerCapacity: string;
  grossWeight: string;
  netWeight: string;
  bodyType: string;
  series: string;
  classification: string;
  vehicleType: string;
  fuelType: string;
  status: FleetStatus;
  ltoRegisterDate: string;
  orCrInfo: string;
  ownershipType: 'Company-owned' | 'Leased';
  acquisitionDate: string;
  purchaseCost: string;
  insuranceProvider: string;
  insuranceExpiry: string;
  gpsTrackerId: string;
  depotLocation: string;
  driverAssigned: string;
  remarks: string;
}
