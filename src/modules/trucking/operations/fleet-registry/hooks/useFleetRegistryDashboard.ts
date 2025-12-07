'use client';

import { useMemo, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import type {
  FleetRegistryRecord,
  FleetRegistrySummary,
  FleetRegistryStats,
  FleetStatus,
} from '../types/fleetRegistry.types';

const sampleFleet: FleetRegistryRecord[] = [
  {
    id: 'fleet-001',
    truckId: 'TRK-001',
    maker: 'Isuzu',
    model: 'N-Series',
    year: 2021,
    plateNo: 'ABC-1234',
    bodyNo: 'B-1001',
    chassisNo: 'CHS-001-XYZ',
    orCrInfo: 'OR-2025-0001',
    ltoRegisterDate: '2025-01-15',
    engineNo: 'ENG-5678-A',
    capacity: '4.5T',
    fuelType: 'Diesel',
    status: 'active',
    remarks: 'Primary delivery unit.',
  },
  {
    id: 'fleet-002',
    truckId: 'TRK-014',
    maker: 'Hino',
    model: '300 Series',
    year: 2020,
    plateNo: 'DEF-5678',
    bodyNo: 'B-1002',
    chassisNo: 'CHS-014-ABC',
    orCrInfo: 'OR-2024-1102',
    ltoRegisterDate: '2024-03-10',
    engineNo: 'ENG-7823-B',
    capacity: '6.5T',
    fuelType: 'Diesel',
    status: 'maintenance',
    remarks: 'Scheduled preventive maintenance.',
  },
  {
    id: 'fleet-003',
    truckId: 'TRK-221',
    maker: 'Fuso',
    model: 'Canter',
    year: 2019,
    plateNo: 'XYZ-9999',
    bodyNo: 'B-1003',
    chassisNo: 'CHS-221-DEF',
    orCrInfo: 'OR-2023-2219',
    ltoRegisterDate: '2023-07-22',
    engineNo: 'ENG-9921-C',
    capacity: '3.0T',
    fuelType: 'Diesel',
    status: 'active',
    remarks: 'Assigned to North Luzon route.',
  },
  {
    id: 'fleet-004',
    truckId: 'TRK-109',
    maker: 'Mitsubishi',
    model: 'Fighter',
    year: 2017,
    plateNo: 'TUV-4567',
    bodyNo: 'B-1004',
    chassisNo: 'CHS-109-GHI',
    orCrInfo: 'OR-2022-1110',
    ltoRegisterDate: '2022-09-05',
    engineNo: 'ENG-4551-D',
    capacity: '10T',
    fuelType: 'Diesel',
    status: 'inactive',
    remarks: 'Awaiting sale; minor body repair.',
  },
  {
    id: 'fleet-005',
    truckId: 'TRK-007',
    maker: 'Hyundai',
    model: 'HD72',
    year: 2015,
    plateNo: 'HJK-8888',
    bodyNo: 'B-1005',
    chassisNo: 'CHS-007-JKL',
    orCrInfo: 'OR-2021-0707',
    ltoRegisterDate: '2021-05-12',
    engineNo: 'ENG-7700-E',
    capacity: '3.5T',
    fuelType: 'Diesel',
    status: 'retired',
    remarks: 'Retired unit kept for parts.',
  },
];

const statusColors: Record<FleetStatus, string> = {
  active: 'green',
  maintenance: 'yellow',
  inactive: 'gray',
  retired: 'red',
};

const normalize = (value: string) => value.toLowerCase().trim();

export function useFleetRegistryDashboard() {
  const [records] = useState<FleetRegistryRecord[]>(sampleFleet);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FleetStatus | 'all'>('all');
  const [fuelFilter, setFuelFilter] = useState<string | null>(null);
  const [makerFilter, setMakerFilter] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<'all' | '5' | '10'>('all');
  const [isImporting, setIsImporting] = useState(false);

  const filteredRecords = useMemo(() => {
    const query = normalize(searchQuery);
    const hasQuery = query.length > 0;

    return records.filter((record) => {
      if (statusFilter !== 'all' && record.status !== statusFilter) {
        return false;
      }

      if (fuelFilter && normalize(record.fuelType) !== normalize(fuelFilter)) {
        return false;
      }

      if (makerFilter && normalize(record.maker) !== normalize(makerFilter)) {
        return false;
      }

      if (yearFilter !== 'all') {
        const cutoff = new Date();
        const years = Number(yearFilter);
        const minYear = cutoff.getFullYear() - years;
        if (record.year < minYear) {
          return false;
        }
      }

      if (!hasQuery) {
        return true;
      }

      const haystack = [
        record.truckId,
        record.maker,
        record.model,
        record.plateNo,
        record.bodyNo,
        record.chassisNo,
        record.engineNo,
        record.remarks,
      ]
        .filter(Boolean)
        .map((value) => normalize(value as string));

      return haystack.some((value) => value.includes(query));
    });
  }, [fuelFilter, makerFilter, records, searchQuery, statusFilter, yearFilter]);

  const stats: FleetRegistryStats = useMemo(() => {
    const activeUnits = records.filter((r) => r.status === 'active').length;
    const inMaintenance = records.filter(
      (r) => r.status === 'maintenance'
    ).length;
    const retiredUnits = records.filter((r) => r.status === 'retired').length;

    const registeredThisYear = records.filter((r) => {
      const year = new Date(r.ltoRegisterDate).getFullYear();
      const nowYear = new Date().getFullYear();
      return year === nowYear;
    }).length;

    return {
      activeUnits,
      inMaintenance,
      registeredThisYear,
      retiredUnits,
    };
  }, [records]);

  const summary: FleetRegistrySummary = useMemo(() => {
    const activeCount = filteredRecords.filter(
      (r) => r.status === 'active'
    ).length;
    const maintenanceCount = filteredRecords.filter(
      (r) => r.status === 'maintenance'
    ).length;

    return {
      totalCount: records.length,
      filteredCount: filteredRecords.length,
      activeCount,
      maintenanceCount,
    };
  }, [filteredRecords, records]);

  const makers = useMemo(
    () => Array.from(new Set(records.map((r) => r.maker))).sort(),
    [records]
  );

  const fuels = useMemo(
    () => Array.from(new Set(records.map((r) => r.fuelType))).sort(),
    [records]
  );

  const getStatusColor = (status: FleetStatus) => statusColors[status];

  const handleImport = async (file: File | null) => {
    if (!file) {
      return;
    }
    setIsImporting(true);
    try {
      await file.text();
      showNotification({
        title: 'Import complete',
        message: `${file.name} processed.`,
      });
    } catch (error) {
      showNotification({
        color: 'red',
        title: 'Import failed',
        message: 'Could not import file.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = () => {
    showNotification({
      title: 'Export triggered',
      message: 'Replace with real export logic.',
    });
  };

  const handleAdd = () => {
    showNotification({
      title: 'Add fleet unit',
      message: 'Replace with real create flow.',
    });
  };

  const handleView = (record: FleetRegistryRecord) => {
    showNotification({
      title: 'View unit',
      message: `${record.truckId} — ${record.maker} ${record.model}`,
    });
  };

  const handleEdit = (record: FleetRegistryRecord) => {
    showNotification({
      title: 'Edit unit',
      message: `Open edit for ${record.truckId} (${record.plateNo}).`,
    });
  };

  const handleRetire = (record: FleetRegistryRecord) => {
    showNotification({
      color: 'red',
      title: 'Retire unit',
      message: `${record.truckId} marked as retired.`,
    });
  };

  return {
    records: filteredRecords,
    stats,
    summary,
    filters: {
      searchQuery,
      setSearchQuery,
      statusFilter,
      setStatusFilter,
      fuelFilter,
      setFuelFilter,
      makerFilter,
      setMakerFilter,
      yearFilter,
      setYearFilter,
      isImporting,
    },
    collections: {
      makers,
      fuels,
    },
    actions: {
      handleImport,
      handleExport,
      handleAdd,
      handleView,
      handleEdit,
      handleRetire,
    },
    getStatusColor,
  };
}
