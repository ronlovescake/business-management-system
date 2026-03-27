import type { TripRecord } from '../components/TripsTable';

export type TripDateRangeFilter = 'all' | '7' | '30';

export type NewTripPayload = Pick<
  TripRecord,
  | 'date'
  | 'truckId'
  | 'destination'
  | 'driver'
  | 'helper'
  | 'grossRevenue'
  | 'fuelLiters'
  | 'fuelCost'
  | 'maintenance'
  | 'tollFees'
  | 'miscExpenses'
  | 'remarks'
  | 'customerId'
  | 'actualDriver'
  | 'actualHelper'
  | 'crewOverrideReason'
  | 'attendanceStatus'
>;

export type FleetVehicle = {
  truckId?: string | null;
  plateNo?: string | null;
  status?: string | null;
};

export type TeamMember = {
  name?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  status?: string | null;
};

export type CustomerLite = {
  id?: number | null;
  customerName?: string | null;
  name?: string | null;
};

export type TripCustomer = {
  id: number;
  name: string;
};

export type VehicleAssignment = {
  vehicleId: string;
  driver: string;
  helper: string;
  startDate: string;
  endDate: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
};

export type ExpectedCrew = {
  driver: string;
  helper: string;
};
