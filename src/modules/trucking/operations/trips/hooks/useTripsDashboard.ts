'use client';

import { useEffect, useMemo, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import type { TripRecord } from '../components/TripsTable';

const seedTrips: TripRecord[] = [
  {
    id: 'trip-001',
    date: '2025-11-30',
    truckId: 'TRK-102',
    grossRevenue: 45000,
    fuelCost: 9500,
    maintenance: 1800,
    tollFees: 1200,
    driver: 'Jonas Velasco',
    helper: 'Mia Santos',
    miscExpenses: 750,
    totalExpenses: 13250,
    remarks: 'Double drop-off, Metro Manila loop',
  },
  {
    id: 'trip-002',
    date: '2025-12-02',
    truckId: 'TRK-205',
    grossRevenue: 52000,
    fuelCost: 10200,
    maintenance: 0,
    tollFees: 1450,
    driver: 'Luis Dizon',
    helper: 'Ivan Cruz',
    miscExpenses: 600,
    totalExpenses: 12250,
    remarks: 'North Luzon pharma delivery',
  },
  {
    id: 'trip-003',
    date: '2025-12-04',
    truckId: 'TRK-307',
    grossRevenue: 38500,
    fuelCost: 8600,
    maintenance: 650,
    tollFees: 980,
    driver: 'Bea Mercado',
    helper: 'Paolo Jimenez',
    miscExpenses: 420,
    totalExpenses: 10650,
    remarks: 'Reefer run to Batangas',
  },
  {
    id: 'trip-004',
    date: '2025-12-05',
    truckId: 'TRK-102',
    grossRevenue: 47800,
    fuelCost: 9900,
    maintenance: 0,
    tollFees: 1320,
    driver: 'Jonas Velasco',
    helper: 'Mia Santos',
    miscExpenses: 510,
    totalExpenses: 11730,
    remarks: 'Cold chain restock – Pampanga',
  },
  {
    id: 'trip-005',
    date: '2025-11-25',
    truckId: 'TRK-410',
    grossRevenue: 56200,
    fuelCost: 11800,
    maintenance: 2100,
    tollFees: 1500,
    driver: 'Hiro Tan',
    helper: 'Angelo Perez',
    miscExpenses: 880,
    totalExpenses: 16280,
    remarks: 'VisMin consolidation drop',
  },
];

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

const normalizeString = (value: string) => value.toLowerCase().trim();

const daysAgoDate = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
};

export type NewTripPayload = Omit<TripRecord, 'id' | 'totalExpenses'>;

type FleetVehicle = {
  truckId?: string | null;
  plateNo?: string | null;
  status?: string | null;
};

type TeamMember = {
  name?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  status?: string | null;
};

const buildEmployeeName = (member: TeamMember) => {
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

const isActive = (status?: string | null) =>
  (status ?? '').toLowerCase().trim() === 'active';

const normalizeJobTitle = (title?: string | null) =>
  (title ?? '').toLowerCase().trim();

export function useTripsDashboard() {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [driverFilter, setDriverFilter] = useState<string | null>(null);
  const [truckFilter, setTruckFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'all' | '7' | '30'>('all');
  const [isImporting, setIsImporting] = useState(false);
  const [isLogTripOpen, setIsLogTripOpen] = useState(false);
  const [drivers, setDrivers] = useState<string[]>([]);
  const [helpers, setHelpers] = useState<string[]>([]);
  const [fleetVehicles, setFleetVehicles] = useState<string[]>([]);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const response = await fetch('/api/trucking/trips', {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('Failed to load trips');
        }
        const data = (await response.json()) as TripRecord[];
        if (Array.isArray(data) && data.length > 0) {
          setTrips(data);
        } else {
          setTrips(seedTrips);
        }
      } catch (error) {
        showNotification({
          title: 'Trips unavailable',
          message:
            error instanceof Error ? error.message : 'Could not load trips',
          color: 'orange',
        });
        setTrips(seedTrips);
      }
    };

    const fetchVehicles = async () => {
      try {
        const response = await fetch('/api/trucking/fleet-vehicles', {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('Failed to load vehicles');
        }
        const payload = (await response.json()) as
          | FleetVehicle[]
          | { data?: FleetVehicle[] };

        const vehicles = Array.isArray(payload)
          ? payload
          : (payload.data ?? []);
        const options = Array.from(
          new Set(
            vehicles
              .map((item) => item.truckId?.trim() || item.plateNo?.trim() || '')
              .filter((v): v is string => Boolean(v))
          )
        ).sort();
        setFleetVehicles(options);
      } catch (error) {
        showNotification({
          title: 'Vehicles unavailable',
          message:
            error instanceof Error
              ? error.message
              : 'Could not load fleet vehicles',
          color: 'orange',
        });
      }
    };

    const fetchTeam = async () => {
      try {
        const response = await fetch('/api/trucking/employees?status=active', {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('Failed to load team');
        }
        const payload = (await response.json()) as
          | TeamMember[]
          | { data?: TeamMember[] };
        const data = Array.isArray(payload) ? payload : (payload.data ?? []);

        const driverNames = new Set<string>();
        const helperNames = new Set<string>();

        data.forEach((member) => {
          if (!isActive(member.status)) {
            return;
          }
          const name = buildEmployeeName(member);
          if (!name) {
            return;
          }

          const job = normalizeJobTitle(member.jobTitle);
          if (job.includes('driver')) {
            driverNames.add(name);
          }
          if (job.includes('helper')) {
            helperNames.add(name);
          }
        });

        setDrivers(Array.from(driverNames).sort());
        setHelpers(Array.from(helperNames).sort());
      } catch (error) {
        showNotification({
          title: 'Team list unavailable',
          message:
            error instanceof Error
              ? error.message
              : 'Could not load team members',
          color: 'orange',
        });
      }
    };

    fetchTrips();
    fetchVehicles();
    fetchTeam();
  }, []);

  const filteredTrips = useMemo(() => {
    const query = normalizeString(searchQuery);
    const hasQuery = query.length > 0;
    const threshold =
      dateRange === 'all' ? null : daysAgoDate(Number(dateRange));

    return trips.filter((trip) => {
      if (
        driverFilter &&
        normalizeString(trip.driver) !== normalizeString(driverFilter)
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

      const haystack = [trip.driver, trip.helper, trip.truckId, trip.remarks]
        .filter(Boolean)
        .map((value) => normalizeString(value as string));

      return haystack.some((value) => value.includes(query));
    });
  }, [dateRange, driverFilter, searchQuery, truckFilter, trips]);

  const sumField = (records: TripRecord[], key: keyof TripRecord) =>
    records.reduce((sum, record) => sum + (record[key] as number), 0);

  const totalRevenue = useMemo(() => sumField(trips, 'grossRevenue'), [trips]);
  const totalExpenses = useMemo(
    () => sumField(trips, 'totalExpenses'),
    [trips]
  );
  const netIncome = useMemo(
    () => totalRevenue - totalExpenses,
    [totalExpenses, totalRevenue]
  );

  const filteredRevenue = useMemo(
    () => sumField(filteredTrips, 'grossRevenue'),
    [filteredTrips]
  );
  const filteredExpenses = useMemo(
    () => sumField(filteredTrips, 'totalExpenses'),
    [filteredTrips]
  );
  const filteredNet = useMemo(
    () => filteredRevenue - filteredExpenses,
    [filteredExpenses, filteredRevenue]
  );

  const tripsThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return trips.filter((trip) => {
      const date = new Date(trip.date);
      return (
        date.getMonth() === currentMonth && date.getFullYear() === currentYear
      );
    }).length;
  }, [trips]);

  const driverOptions = useMemo(() => {
    const seed = Array.from(new Set(trips.map((trip) => trip.driver))).sort();
    const merged = new Set([...(drivers || []), ...seed]);
    return Array.from(merged).sort();
  }, [drivers, trips]);

  const helperOptions = useMemo(() => {
    const seed = Array.from(new Set(trips.map((trip) => trip.helper))).filter(
      Boolean
    ) as string[];
    const merged = new Set([...(helpers || []), ...seed]);
    return Array.from(merged).sort();
  }, [helpers, trips]);

  const truckOptions = useMemo(() => {
    const seed = Array.from(new Set(trips.map((trip) => trip.truckId))).sort();
    const merged = new Set([...(fleetVehicles || []), ...seed]);
    return Array.from(merged).sort();
  }, [fleetVehicles, trips]);

  const formatCurrency = (value: number) => pesoFormatter.format(value);

  const handleImportTrips = async (file: File | null) => {
    if (!file) {
      return;
    }

    setIsImporting(true);
    try {
      await file.text();
      showNotification({
        title: 'Import queued',
        message: `${file.name} uploaded for processing`,
        color: 'blue',
      });
    } catch (error) {
      showNotification({
        title: 'Import failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const convertToCsv = (records: TripRecord[]) => {
    const headers = [
      'ID',
      'Date',
      'Vehicle ID',
      'Driver',
      'Helper',
      'Gross Revenue',
      'Fuel Cost',
      'Maintenance',
      'Toll Fees',
      'Misc Expenses',
      'Total Expenses',
      'Remarks',
    ];

    const csvRows = records.map((record) =>
      [
        record.id,
        record.date,
        record.truckId,
        record.driver,
        record.helper,
        record.grossRevenue,
        record.fuelCost,
        record.maintenance,
        record.tollFees,
        record.miscExpenses,
        record.totalExpenses,
        record.remarks,
      ]
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );

    return [headers.join(','), ...csvRows].join('\n');
  };

  const handleExportTrips = () => {
    const csv = convertToCsv(filteredTrips);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trips-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification({
      title: 'Export ready',
      message: 'Filtered trips CSV generated successfully.',
      color: 'green',
    });
  };

  const openLogTrip = () => setIsLogTripOpen(true);
  const closeLogTrip = () => setIsLogTripOpen(false);

  const handleCreateTrip = async (payload: NewTripPayload) => {
    try {
      const response = await fetch('/api/trucking/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save trip');
      }

      const created = (await response.json()) as TripRecord;
      setTrips((prev) => [created, ...prev]);

      showNotification({
        title: 'Trip logged',
        message: `${created.truckId} • ${created.driver} • ${created.date}`,
        color: 'green',
      });
    } catch (error) {
      const totalExpenses =
        payload.fuelCost +
        payload.maintenance +
        payload.tollFees +
        payload.miscExpenses;

      const fallbackTrip: TripRecord = {
        ...payload,
        totalExpenses,
        id: `trip-${Date.now()}`,
      };

      setTrips((prev) => [fallbackTrip, ...prev]);

      showNotification({
        title: 'Saved offline',
        message:
          error instanceof Error
            ? error.message
            : 'Trip stored locally; will not persist to server',
        color: 'orange',
      });
    } finally {
      closeLogTrip();
    }
  };

  return {
    trips,
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
      isImporting,
    },
    collections: {
      drivers: driverOptions,
      helpers: helperOptions,
      trucks: truckOptions,
    },
    actions: {
      handleImportTrips,
      handleExportTrips,
      handleLogTrip: openLogTrip,
      handleCreateTrip,
      closeLogTrip,
    },
    modals: {
      logTrip: {
        opened: isLogTripOpen,
        onClose: closeLogTrip,
        onSubmit: handleCreateTrip,
      },
    },
    formatCurrency,
  };
}
