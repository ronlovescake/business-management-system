import type { TripRecord } from '../components/TripsTable';
import type {
  ExpectedCrew,
  TeamMember,
  TripCustomer,
  TripDateRangeFilter,
  VehicleAssignment,
} from './tripsDashboardTypes';

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

export const formatTripCurrency = (value: number) =>
  pesoFormatter.format(value);

export const normalizeString = (value: string) => value.toLowerCase().trim();

export const daysAgoDate = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const buildEmployeeName = (member: TeamMember) => {
  const primary = member.name?.trim();
  if (primary) {
    return primary;
  }

  const composed = [member.firstName, member.middleName, member.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  return composed || '';
};

export const isActiveStatus = (status?: string | null) =>
  (status ?? '').toLowerCase().trim() === 'active';

export const normalizeJobTitle = (title?: string | null) =>
  (title ?? '').toLowerCase().trim();

export const normalizeTripRecord = (trip: TripRecord): TripRecord => ({
  ...trip,
  destination: (trip.destination || '—').trim(),
  fuelLiters:
    typeof trip.fuelLiters === 'number' && Number.isFinite(trip.fuelLiters)
      ? trip.fuelLiters
      : Number(trip.fuelLiters || 0),
  helper: trip.helper || '',
  remarks: trip.remarks || '',
  status: trip.status || 'draft',
  completedAt: trip.completedAt || null,
  customerId: trip.customerId ?? null,
  customerName: trip.customerName ?? null,
  invoiceId: trip.invoiceId ?? null,
  actualDriver: trip.actualDriver ?? trip.driver ?? '',
  actualHelper: trip.actualHelper ?? trip.helper ?? '',
  crewOverrideReason: trip.crewOverrideReason ?? null,
  attendanceStatus: trip.attendanceStatus ?? 'UNCONFIRMED',
});

export const applyCustomerNamesToTrips = (
  trips: TripRecord[],
  customers: TripCustomer[]
) => {
  if (!customers.length) {
    return trips;
  }

  const customerMap = new Map(
    customers.map((customer) => [customer.id, customer.name])
  );

  return trips.map((trip) => ({
    ...trip,
    customerName:
      typeof trip.customerId === 'number'
        ? (customerMap.get(trip.customerId) ?? trip.customerName ?? null)
        : (trip.customerName ?? null),
  }));
};

export const buildExpectedCrewResolver = (assignments: VehicleAssignment[]) => {
  const byVehicle = new Map<string, VehicleAssignment[]>();

  assignments.forEach((assignment) => {
    if (!byVehicle.has(assignment.vehicleId)) {
      byVehicle.set(assignment.vehicleId, []);
    }
    byVehicle.get(assignment.vehicleId)?.push(assignment);
  });

  return (truckId: string, date: Date | null): ExpectedCrew | null => {
    if (!truckId || !date) {
      return null;
    }

    const candidates = byVehicle.get(truckId.trim());
    if (!candidates?.length) {
      return null;
    }

    const target = date.toISOString().slice(0, 10);
    const match = candidates.find((assignment) => {
      if (!['active', 'scheduled'].includes(assignment.status)) {
        return false;
      }

      return (
        target >= assignment.startDate.slice(0, 10) &&
        target <= assignment.endDate.slice(0, 10)
      );
    });

    if (!match) {
      return null;
    }

    return {
      driver: match.driver,
      helper: match.helper,
    };
  };
};

export const filterTrips = (params: {
  trips: TripRecord[];
  searchQuery: string;
  driverFilter: string | null;
  truckFilter: string | null;
  dateRange: TripDateRangeFilter;
}) => {
  const { trips, searchQuery, driverFilter, truckFilter, dateRange } = params;
  const query = normalizeString(searchQuery);
  const hasQuery = query.length > 0;
  const threshold = dateRange === 'all' ? null : daysAgoDate(Number(dateRange));

  return trips.filter((trip) => {
    if (
      driverFilter &&
      normalizeString(trip.actualDriver || trip.driver) !==
        normalizeString(driverFilter)
    ) {
      return false;
    }

    if (
      truckFilter &&
      normalizeString(trip.truckId) !== normalizeString(truckFilter)
    ) {
      return false;
    }

    if (threshold) {
      const tripDate = new Date(trip.date);
      if (tripDate < threshold) {
        return false;
      }
    }

    if (!hasQuery) {
      return true;
    }

    const haystack = [
      trip.actualDriver || trip.driver,
      trip.actualHelper || trip.helper,
      trip.truckId,
      trip.destination,
      trip.remarks,
      trip.customerName,
    ]
      .filter(Boolean)
      .map((value) => normalizeString(value as string));

    return haystack.some((value) => value.includes(query));
  });
};

export const sumTripField = (records: TripRecord[], key: keyof TripRecord) =>
  records.reduce((sum, record) => sum + (record[key] as number), 0);

export const countTripsThisMonth = (records: TripRecord[]) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return records.filter((trip) => {
    const date = new Date(trip.date);
    return (
      date.getMonth() === currentMonth && date.getFullYear() === currentYear
    );
  }).length;
};

export const buildSortedUniqueStrings = (
  values: Array<string | null | undefined>
) => {
  return Array.from(
    new Set(values.map((value) => (value || '').trim()).filter(Boolean))
  ).sort();
};

export const buildTripsCsv = (records: TripRecord[]) => {
  const headers = [
    'ID',
    'Date',
    'Vehicle ID',
    'Destination',
    'Customer ID',
    'Driver (Actual)',
    'Helper (Actual)',
    'Crew Override Reason',
    'Attendance Status',
    'Gross Revenue',
    'Fuel (Liters)',
    'Fuel Cost',
    'Maintenance',
    'Toll Fees',
    'Driver',
    'Helper',
    'Misc Expenses',
    'Total Expenses',
    'Remarks',
  ];

  const rows = records.map((record) =>
    [
      record.id,
      record.date,
      record.truckId,
      record.destination,
      record.customerId ?? '',
      record.actualDriver ?? record.driver,
      record.actualHelper ?? record.helper,
      record.crewOverrideReason ?? '',
      record.attendanceStatus ?? '',
      record.grossRevenue,
      record.fuelLiters,
      record.fuelCost,
      record.maintenance,
      record.tollFees,
      record.driver,
      record.helper,
      record.miscExpenses,
      record.totalExpenses,
      record.remarks,
    ]
      .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
};
