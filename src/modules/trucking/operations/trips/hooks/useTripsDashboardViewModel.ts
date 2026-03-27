import { useMemo, useState } from 'react';
import type { TripRecord } from '../components/TripsTable';
import type {
  TripCustomer,
  TripDateRangeFilter,
  VehicleAssignment,
} from './tripsDashboardTypes';
import {
  buildExpectedCrewResolver,
  buildSortedUniqueStrings,
  countTripsThisMonth,
  filterTrips,
  formatTripCurrency,
  sumTripField,
} from './tripsDashboardUtils';

interface UseTripsDashboardViewModelParams {
  trips: TripRecord[];
  drivers: string[];
  helpers: string[];
  fleetVehicles: string[];
  customers: TripCustomer[];
  assignments: VehicleAssignment[];
}

export function useTripsDashboardViewModel({
  trips,
  drivers,
  helpers,
  fleetVehicles,
  customers,
  assignments,
}: UseTripsDashboardViewModelParams) {
  const [searchQuery, setSearchQuery] = useState('');
  const [driverFilter, setDriverFilter] = useState<string | null>(null);
  const [truckFilter, setTruckFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<TripDateRangeFilter>('all');

  const findExpectedCrew = useMemo(
    () => buildExpectedCrewResolver(assignments),
    [assignments]
  );

  const filteredTrips = useMemo(
    () =>
      filterTrips({
        trips,
        searchQuery,
        driverFilter,
        truckFilter,
        dateRange,
      }),
    [dateRange, driverFilter, searchQuery, truckFilter, trips]
  );

  const totalRevenue = useMemo(
    () => sumTripField(filteredTrips, 'grossRevenue'),
    [filteredTrips]
  );
  const totalExpenses = useMemo(
    () => sumTripField(filteredTrips, 'totalExpenses'),
    [filteredTrips]
  );
  const netIncome = useMemo(
    () => totalRevenue - totalExpenses,
    [totalExpenses, totalRevenue]
  );
  const filteredRevenue = useMemo(
    () => sumTripField(filteredTrips, 'grossRevenue'),
    [filteredTrips]
  );
  const filteredExpenses = useMemo(
    () => sumTripField(filteredTrips, 'totalExpenses'),
    [filteredTrips]
  );
  const filteredNet = useMemo(
    () => filteredRevenue - filteredExpenses,
    [filteredExpenses, filteredRevenue]
  );
  const tripsThisMonth = useMemo(
    () => countTripsThisMonth(filteredTrips),
    [filteredTrips]
  );

  const driverOptions = useMemo(() => {
    const seeded = buildSortedUniqueStrings(
      trips.map((trip) => trip.actualDriver || trip.driver || '')
    );
    return buildSortedUniqueStrings([...drivers, ...seeded]);
  }, [drivers, trips]);

  const helperOptions = useMemo(() => {
    const seeded = buildSortedUniqueStrings(
      trips.map((trip) => trip.actualHelper || trip.helper || '')
    );
    return buildSortedUniqueStrings([...helpers, ...seeded]);
  }, [helpers, trips]);

  const truckOptions = useMemo(() => {
    const seeded = buildSortedUniqueStrings(
      trips.map((trip) => trip.truckId || '')
    );
    return buildSortedUniqueStrings([...fleetVehicles, ...seeded]);
  }, [fleetVehicles, trips]);

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        label: customer.name,
        value: String(customer.id),
      })),
    [customers]
  );

  return {
    filteredTrips,
    stats: {
      totalRevenue,
      totalExpenses,
      netIncome,
      tripsThisMonth,
    },
    summary: {
      totalCount: trips.length,
      filteredCount: filteredTrips.length,
      filteredRevenue,
      filteredExpenses,
      filteredNet,
    },
    filters: {
      searchQuery,
      setSearchQuery,
      driverFilter,
      setDriverFilter,
      truckFilter,
      setTruckFilter,
      dateRange,
      setDateRange,
    },
    collections: {
      drivers: driverOptions,
      helpers: helperOptions,
      trucks: truckOptions,
      customers: customerOptions,
    },
    findExpectedCrew,
    formatCurrency: formatTripCurrency,
  };
}
