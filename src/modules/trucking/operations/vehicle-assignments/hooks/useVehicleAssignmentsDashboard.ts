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

type VehicleAssignmentApiRecord = {
  id: string;
  vehicleId: string;
  plateNo: string;
  driver: string;
  helper: string;
  startDate: string;
  endDate: string;
  status: VehicleAssignmentStatus;
  route?: string;
  notes?: string;
};

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
  const [records, setRecords] = useState<VehicleAssignmentRecord[]>([]);
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

  const fetchAssignments = useCallback(async () => {
    try {
      const response = await fetch('/api/trucking/vehicle-assignments', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to load vehicle assignments');
      }

      const payload = (await response.json()) as {
        data?: VehicleAssignmentApiRecord[];
      };

      const loaded = (payload.data ?? []).map((row) => ({
        id: row.id,
        vehicleId: row.vehicleId,
        plateNo: row.plateNo,
        driver: row.driver,
        helper: row.helper,
        startDate: row.startDate,
        endDate: row.endDate,
        status: row.status,
        route: row.route,
        notes: row.notes,
      }));

      setRecords(loaded);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load vehicle assignments';
      showNotification({
        color: 'red',
        title: 'Assignments unavailable',
        message,
      });
      setRecords([]);
    }
  }, []);

  useEffect(() => {
    void fetchAssignments();
  }, [fetchAssignments]);

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

    const activeCount = filteredRecords.filter(
      (r) => r.status === 'active'
    ).length;
    const scheduledThisWeek = filteredRecords.filter((r) => {
      if (r.status !== 'scheduled') {
        return false;
      }
      const start = new Date(r.startDate);
      return start >= now && start <= weekFromNow;
    }).length;

    const endingSoon = filteredRecords.filter((r) =>
      isWithinDaysFromNow(r.endDate, 7)
    ).length;

    const completedThisMonth = filteredRecords.filter((r) => {
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
  }, [filteredRecords]);

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

  const handleCreateAssignment = async (payload: VehicleAssignmentDraft) => {
    try {
      const response = await fetch('/api/trucking/vehicle-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = (await response.json()) as {
        data?: VehicleAssignmentApiRecord;
        error?: string;
      };

      if (!response.ok || !json.data) {
        throw new Error(json.error || 'Failed to create assignment');
      }

      const saved: VehicleAssignmentRecord = {
        id: json.data.id,
        vehicleId: json.data.vehicleId,
        plateNo: json.data.plateNo,
        driver: json.data.driver,
        helper: json.data.helper,
        startDate: json.data.startDate,
        endDate: json.data.endDate,
        status: json.data.status,
        route: json.data.route,
        notes: json.data.notes,
      };

      setRecords((prev) => [saved, ...prev]);
      showNotification({
        title: 'Assignment created',
        message: `${saved.driver} & ${saved.helper} assigned to ${saved.vehicleId}.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create assignment';
      showNotification({
        color: 'red',
        title: 'Create failed',
        message,
      });
    }
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

  const updateStatus = async (
    record: VehicleAssignmentRecord,
    nextStatus: VehicleAssignmentStatus
  ) => {
    try {
      const response = await fetch(
        `/api/trucking/vehicle-assignments/${record.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        }
      );

      const json = (await response.json()) as {
        data?: VehicleAssignmentApiRecord;
        error?: string;
      };

      if (!response.ok || !json.data) {
        throw new Error(json.error || 'Failed to update assignment');
      }

      const updatedStatus = json.data.status;

      setRecords((prev) =>
        prev.map((row) =>
          row.id === record.id
            ? {
                ...row,
                status: updatedStatus,
              }
            : row
        )
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update assignment';
      showNotification({
        color: 'red',
        title: 'Update failed',
        message,
      });
    }
  };

  const handleMarkComplete = (record: VehicleAssignmentRecord) => {
    void updateStatus(record, 'completed');
  };

  const handleCancel = (record: VehicleAssignmentRecord) => {
    void updateStatus(record, 'cancelled');
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
