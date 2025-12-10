'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import type {
  VehicleAssignmentRecord,
  VehicleAssignmentStatus,
  VehicleAssignmentSummary,
  VehicleAssignmentStats,
  VehicleAssignmentDraft,
  VehicleAssignmentVehicleOption,
} from '../types/vehicleAssignments.types';
import type { FleetRegistryRecord } from '../../fleet-registry/types/fleetRegistry.types';

type TeamEmployeeSummary = {
  id: string | number;
  employeeId?: string | null;
  name?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  status?: string | null;
};

const sampleAssignments: VehicleAssignmentRecord[] = [
  {
    id: 'assign-001',
    vehicleId: 'TRK-001',
    plateNo: 'ABC-1234',
    driver: 'Juan Dela Cruz',
    helper: 'Marco Santos',
    startDate: '2025-12-05',
    endDate: '2025-12-08',
    status: 'active',
    route: 'Manila → Baguio',
    notes: 'Priority deliveries; keep refrigerated.',
  },
  {
    id: 'assign-002',
    vehicleId: 'TRK-014',
    plateNo: 'DEF-5678',
    driver: 'Liza Moreno',
    helper: 'Paolo Cruz',
    startDate: '2025-12-10',
    endDate: '2025-12-14',
    status: 'scheduled',
    route: 'Clark → Cebu (RoRo)',
    notes: 'Spare driver on standby.',
  },
  {
    id: 'assign-003',
    vehicleId: 'TRK-221',
    plateNo: 'XYZ-9999',
    driver: 'Chen Wu',
    helper: 'Maria Lopez',
    startDate: '2025-12-01',
    endDate: '2025-12-02',
    status: 'completed',
    route: 'Laguna → Batangas',
    notes: 'Returned with minor dent reported.',
  },
  {
    id: 'assign-004',
    vehicleId: 'TRK-109',
    plateNo: 'TUV-4567',
    driver: 'Andre Ramos',
    helper: 'Kai Tan',
    startDate: '2025-11-28',
    endDate: '2025-12-03',
    status: 'active',
    route: 'Subic → La Union',
    notes: 'Night driving restrictions in effect.',
  },
  {
    id: 'assign-005',
    vehicleId: 'TRK-007',
    plateNo: 'HJK-8888',
    driver: 'Nick Ortega',
    helper: 'Omar Reyes',
    startDate: '2025-11-18',
    endDate: '2025-11-20',
    status: 'cancelled',
    route: 'Cavite → Tarlac',
    notes: 'Cancelled due to unit maintenance.',
  },
];

const normalize = (value: string) => value.toLowerCase().trim();

const statusColors: Record<VehicleAssignmentStatus, string> = {
  scheduled: 'blue',
  active: 'green',
  completed: 'gray',
  cancelled: 'red',
};

const daysAgoDate = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
};

const isWithinDaysFromNow = (dateString: string, days: number) => {
  const now = new Date();
  const target = new Date(dateString);
  const diff = target.getTime() - now.getTime();
  const daysDiff = diff / (1000 * 60 * 60 * 24);
  return daysDiff >= 0 && daysDiff <= days;
};

const buildEmployeeName = (employee: TeamEmployeeSummary) => {
  const primaryName = employee.name?.trim();
  if (primaryName && primaryName.length > 0) {
    return primaryName;
  }

  const fallbackName = [
    employee.firstName,
    employee.middleName,
    employee.lastName,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  if (fallbackName.length > 0) {
    return fallbackName;
  }

  return employee.employeeId?.trim() || '';
};

const normalizeJobTitle = (title?: string | null) =>
  title?.toLowerCase().trim() || '';

const isActiveTeamMember = (status?: string | null) =>
  (status?.toLowerCase().trim() || '') === 'active';

export function useVehicleAssignmentsDashboard() {
  const [records, setRecords] =
    useState<VehicleAssignmentRecord[]>(sampleAssignments);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    VehicleAssignmentStatus | 'all'
  >('all');
  const [driverFilter, setDriverFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'all' | '7' | '30'>('all');
  const [isImporting, setIsImporting] = useState(false);
  const [fleetVehicles, setFleetVehicles] = useState<
    VehicleAssignmentVehicleOption[]
  >([]);
  const [teamMembers, setTeamMembers] = useState<TeamEmployeeSummary[]>([]);

  const fetchFleetVehicles = useCallback(async () => {
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

      const options = (payload.data ?? [])
        .map((record) => {
          const vehicleId = record.truckId?.trim() || record.id?.trim();
          if (!vehicleId) {
            return null;
          }
          const plateNo = record.plateNo?.trim() || 'No plate';
          return {
            vehicleId,
            plateNo,
            label: `${vehicleId} — ${plateNo}`,
          } satisfies VehicleAssignmentVehicleOption;
        })
        .filter((option): option is VehicleAssignmentVehicleOption =>
          Boolean(option)
        );

      const dedupedMap = new Map<string, VehicleAssignmentVehicleOption>();
      options.forEach((option) => {
        dedupedMap.set(option.vehicleId, option);
      });

      setFleetVehicles(
        Array.from(dedupedMap.values()).sort((a, b) =>
          a.vehicleId.localeCompare(b.vehicleId, undefined, {
            sensitivity: 'base',
          })
        )
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load fleet vehicles';
      showNotification({
        color: 'red',
        title: 'Vehicle list unavailable',
        message,
      });
      setFleetVehicles([]);
    }
  }, []);

  useEffect(() => {
    void fetchFleetVehicles();
  }, [fetchFleetVehicles]);

  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch('/api/trucking/employees?status=active', {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Failed to load team members');
      }

      const payload = (await response.json()) as TeamEmployeeSummary[];
      setTeamMembers(payload);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load team members';
      showNotification({
        color: 'red',
        title: 'Team directory unavailable',
        message,
      });
      setTeamMembers([]);
    }
  }, []);

  useEffect(() => {
    void fetchTeamMembers();
  }, [fetchTeamMembers]);

  const filteredRecords = useMemo(() => {
    const query = normalize(searchQuery);
    const hasQuery = query.length > 0;
    const threshold =
      dateRange === 'all' ? null : daysAgoDate(Number(dateRange));

    return records.filter((record) => {
      if (statusFilter !== 'all' && record.status !== statusFilter) {
        return false;
      }

      if (
        driverFilter &&
        normalize(record.driver) !== normalize(driverFilter)
      ) {
        return false;
      }

      if (threshold) {
        const start = new Date(record.startDate);
        if (start < threshold) {
          return false;
        }
      }

      if (!hasQuery) {
        return true;
      }

      const haystack = [
        record.vehicleId,
        record.plateNo,
        record.driver,
        record.helper,
        record.route,
        record.notes,
      ]
        .filter(Boolean)
        .map((value) => normalize(value as string));

      return haystack.some((value) => value.includes(query));
    });
  }, [dateRange, driverFilter, records, searchQuery, statusFilter]);

  const stats: VehicleAssignmentStats = useMemo(() => {
    const now = new Date();
    const weekFromNow = new Date(now);
    weekFromNow.setDate(now.getDate() + 7);

    const activeCount = records.filter((r) => r.status === 'active').length;
    const scheduledThisWeek = records.filter((r) => {
      if (r.status !== 'scheduled') {
        return false;
      }
      const start = new Date(r.startDate);
      return start >= now && start <= weekFromNow;
    }).length;

    const endingSoon = records.filter((r) =>
      isWithinDaysFromNow(r.endDate, 7)
    ).length;

    const completedThisMonth = records.filter((r) => {
      if (r.status !== 'completed') {
        return false;
      }
      const end = new Date(r.endDate);
      const m = now.getMonth();
      const y = now.getFullYear();
      return end.getMonth() === m && end.getFullYear() === y;
    }).length;

    return {
      activeCount,
      scheduledThisWeek,
      endingSoon,
      completedThisMonth,
    };
  }, [records]);

  const summary: VehicleAssignmentSummary = useMemo(() => {
    const filteredActiveCount = filteredRecords.filter(
      (r) => r.status === 'active'
    ).length;
    const filteredScheduledCount = filteredRecords.filter(
      (r) => r.status === 'scheduled'
    ).length;
    const filteredEndingSoonCount = filteredRecords.filter((r) =>
      isWithinDaysFromNow(r.endDate, 7)
    ).length;

    return {
      totalCount: records.length,
      filteredCount: filteredRecords.length,
      filteredActiveCount,
      filteredScheduledCount,
      filteredEndingSoonCount,
    };
  }, [filteredRecords, records]);

  const { teamDrivers, teamHelpers } = useMemo(() => {
    const driverSet = new Set<string>();
    const helperSet = new Set<string>();

    teamMembers.forEach((employee) => {
      if (!isActiveTeamMember(employee.status)) {
        return;
      }
      const normalizedTitle = normalizeJobTitle(employee.jobTitle);
      const fullName = buildEmployeeName(employee);
      if (!fullName) {
        return;
      }

      if (normalizedTitle === 'driver') {
        driverSet.add(fullName);
      }

      if (normalizedTitle === 'helper') {
        helperSet.add(fullName);
      }
    });

    const sortByName = (a: string, b: string) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' });

    return {
      teamDrivers: Array.from(driverSet).sort(sortByName),
      teamHelpers: Array.from(helperSet).sort(sortByName),
    };
  }, [teamMembers]);

  const assignmentDrivers = useMemo(() => {
    const uniqueDrivers = new Set<string>();
    records.forEach((record) => {
      if (record.driver) {
        uniqueDrivers.add(record.driver.trim());
      }
    });
    return Array.from(uniqueDrivers).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [records]);

  const assignmentHelpers = useMemo(() => {
    const uniqueHelpers = new Set<string>();
    records.forEach((record) => {
      if (record.helper) {
        uniqueHelpers.add(record.helper.trim());
      }
    });
    return Array.from(uniqueHelpers).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [records]);

  const drivers = teamDrivers.length > 0 ? teamDrivers : assignmentDrivers;
  const helpers = teamHelpers.length > 0 ? teamHelpers : assignmentHelpers;

  const assignmentVehicleOptions: VehicleAssignmentVehicleOption[] =
    useMemo(() => {
      const map = new Map<string, VehicleAssignmentVehicleOption>();
      records.forEach((record) => {
        const vehicleId = record.vehicleId?.trim();
        if (!vehicleId || map.has(vehicleId)) {
          return;
        }
        const plateNo = record.plateNo?.trim() || 'No plate';
        map.set(vehicleId, {
          vehicleId,
          plateNo,
          label: `${vehicleId} — ${plateNo}`,
        });
      });
      return Array.from(map.values()).sort((a, b) =>
        a.vehicleId.localeCompare(b.vehicleId, undefined, {
          sensitivity: 'base',
        })
      );
    }, [records]);

  const vehicles = useMemo(
    () => (fleetVehicles.length > 0 ? fleetVehicles : assignmentVehicleOptions),
    [assignmentVehicleOptions, fleetVehicles]
  );

  const getStatusColor = (status: VehicleAssignmentStatus) =>
    statusColors[status];

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

  const handleCreateAssignment = (payload: VehicleAssignmentDraft) => {
    const trimmedVehicleId = payload.vehicleId.trim();
    const trimmedPlateNo = payload.plateNo.trim();
    const trimmedDriver = payload.driver.trim();
    const trimmedHelper = payload.helper.trim();
    const normalizedVehicleId = trimmedVehicleId.toUpperCase();
    const normalizedPlateNo = trimmedPlateNo.toUpperCase();

    const newRecord: VehicleAssignmentRecord = {
      id: `assign-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`,
      vehicleId: normalizedVehicleId,
      plateNo: normalizedPlateNo,
      driver: trimmedDriver,
      helper: trimmedHelper,
      startDate: payload.startDate,
      endDate: payload.endDate,
      status: payload.status,
      route: payload.route?.trim() || undefined,
      notes: payload.notes?.trim() || undefined,
    };

    setRecords((prev) => [newRecord, ...prev]);

    showNotification({
      title: 'Assignment created',
      message: `${trimmedDriver} & ${trimmedHelper} assigned to ${normalizedVehicleId}.`,
    });
  };

  const handleView = (record: VehicleAssignmentRecord) => {
    showNotification({
      title: 'View assignment',
      message: `${record.vehicleId} — ${record.driver}`,
    });
  };

  const handleEdit = (record: VehicleAssignmentRecord) => {
    showNotification({
      title: 'Edit assignment',
      message: `Open edit for ${record.vehicleId} (${record.plateNo}).`,
    });
  };

  const handleMarkComplete = (record: VehicleAssignmentRecord) => {
    showNotification({
      title: 'Mark complete',
      message: `${record.vehicleId} marked as completed.`,
    });
  };

  const handleCancel = (record: VehicleAssignmentRecord) => {
    showNotification({
      color: 'red',
      title: 'Assignment cancelled',
      message: `${record.vehicleId} cancelled.`,
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
      driverFilter,
      setDriverFilter,
      dateRange,
      setDateRange,
      isImporting,
    },
    collections: {
      drivers,
      helpers,
      vehicles,
    },
    actions: {
      handleImport,
      handleExport,
      handleView,
      handleEdit,
      handleMarkComplete,
      handleCancel,
      handleCreateAssignment,
    },
    getStatusColor,
  };
}
