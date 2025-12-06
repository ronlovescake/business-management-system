'use client';

import { useMemo, useState } from 'react';
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

export function useTripsDashboard() {
  const [trips] = useState<TripRecord[]>(seedTrips);
  const [searchQuery, setSearchQuery] = useState('');
  const [driverFilter, setDriverFilter] = useState<string | null>(null);
  const [truckFilter, setTruckFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'all' | '7' | '30'>('all');
  const [isImporting, setIsImporting] = useState(false);

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

  const drivers = useMemo(
    () => Array.from(new Set(trips.map((trip) => trip.driver))).sort(),
    [trips]
  );
  const trucks = useMemo(
    () => Array.from(new Set(trips.map((trip) => trip.truckId))).sort(),
    [trips]
  );

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
      'Truck ID',
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

  const handleLogTrip = () => {
    showNotification({
      title: 'Log Trip',
      message: 'Trip logging workflow coming soon.',
      color: 'teal',
    });
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
      drivers,
      trucks,
    },
    actions: {
      handleImportTrips,
      handleExportTrips,
      handleLogTrip,
    },
    formatCurrency,
  };
}
