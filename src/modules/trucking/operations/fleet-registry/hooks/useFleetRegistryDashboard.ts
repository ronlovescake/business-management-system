'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import { useRouter } from 'next/navigation';
import type {
  FleetRegistryRecord,
  FleetRegistrySummary,
  FleetRegistryStats,
  FleetStatus,
  FleetUnitFormValues,
} from '../types/fleetRegistry.types';
import { statusColors } from '../data/fleetRegistryData';
import { createDefaultFleetUnitFormValues } from '../utils/formTransforms';

const normalize = (value: string) => value.toLowerCase().trim();

export function useFleetRegistryDashboard() {
  const [records, setRecords] = useState<FleetRegistryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FleetStatus | 'all'>('all');
  const [fuelFilter, setFuelFilter] = useState<string | null>(null);
  const [makerFilter, setMakerFilter] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<'all' | '5' | '10'>('all');
  const [isImporting, setIsImporting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmittingAddUnit, setIsSubmittingAddUnit] = useState(false);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalInitialValues, setModalInitialValues] =
    useState<FleetUnitFormValues>(createDefaultFleetUnitFormValues());
  const router = useRouter();

  const fetchRecords = useCallback(async () => {
    setIsLoadingRecords(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/trucking/fleet-vehicles', {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Failed to load fleet vehicles');
      }
      const payload = (await response.json()) as {
        data?: FleetRegistryRecord[];
      };
      setRecords(payload.data ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load vehicles';
      setLoadError(message);
      showNotification({
        color: 'red',
        title: 'Fleet data unavailable',
        message,
      });
    } finally {
      setIsLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

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
        record.passengerCapacity,
        record.grossWeight,
        record.netWeight,
        record.bodyType,
        record.series,
        record.classification,
        record.vehicleType,
        record.remarks,
      ]
        .filter(Boolean)
        .map((value) => normalize(value as string));

      return haystack.some((value) => value.includes(query));
    });
  }, [fuelFilter, makerFilter, records, searchQuery, statusFilter, yearFilter]);

  const stats: FleetRegistryStats = useMemo(() => {
    const activeUnits = filteredRecords.filter(
      (r) => r.status === 'active'
    ).length;
    const inMaintenance = filteredRecords.filter(
      (r) => r.status === 'maintenance'
    ).length;
    const retiredUnits = filteredRecords.filter(
      (r) => r.status === 'retired'
    ).length;

    const registeredThisYear = filteredRecords.filter((r) => {
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
  }, [filteredRecords]);

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
    setModalInitialValues(createDefaultFleetUnitFormValues());
    setIsAddModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
  };

  const handleAddSubmit = async (values: FleetUnitFormValues) => {
    setIsSubmittingAddUnit(true);
    try {
      const response = await fetch('/api/trucking/fleet-vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        data?: FleetRegistryRecord;
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error || 'Failed to save vehicle');
      }

      const created = payload.data;
      setRecords((current) => [created, ...current]);
      setIsAddModalOpen(false);
      showNotification({
        title: 'Fleet unit recorded',
        message: `${created.truckId} added to the registry.`,
        color: 'green',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not save fleet unit.';
      showNotification({
        color: 'red',
        title: 'Save failed',
        message,
      });
    } finally {
      setIsSubmittingAddUnit(false);
    }
  };

  const handleView = useCallback(
    (record: FleetRegistryRecord) => {
      const slug = record.truckId?.trim() || record.id;
      if (!slug) {
        showNotification({
          color: 'red',
          title: 'Unable to open vehicle',
          message: 'This fleet entry is missing a valid identifier.',
        });
        return;
      }

      router.push(`/trucking/operations/fleet-registry/${slug}`);
    },
    [router]
  );

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
    status: {
      isLoading: isLoadingRecords,
      error: loadError,
      refresh: fetchRecords,
    },
    actions: {
      handleImport,
      handleExport,
      handleAdd,
      handleView,
      handleEdit,
      handleRetire,
    },
    modal: {
      opened: isAddModalOpen,
      initialValues: modalInitialValues,
      onClose: handleCloseModal,
      onSubmit: handleAddSubmit,
      isSubmitting: isSubmittingAddUnit,
    },
    getStatusColor,
  };
}
