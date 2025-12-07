'use client';

import { useMemo, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import type {
  TruckAssignmentRecord,
  TruckAssignmentStatus,
  TruckAssignmentSummary,
  TruckAssignmentStats,
} from '../types/truckAssignments.types';

const sampleAssignments: TruckAssignmentRecord[] = [
  {
    id: 'assign-001',
    truckId: 'TRK-001',
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
    truckId: 'TRK-014',
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
    truckId: 'TRK-221',
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
    truckId: 'TRK-109',
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
    truckId: 'TRK-007',
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

const statusColors: Record<TruckAssignmentStatus, string> = {
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

export function useTruckAssignmentsDashboard() {
  const [records] = useState<TruckAssignmentRecord[]>(sampleAssignments);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    TruckAssignmentStatus | 'all'
  >('all');
  const [driverFilter, setDriverFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'all' | '7' | '30'>('all');
  const [isImporting, setIsImporting] = useState(false);

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
        record.truckId,
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

  const stats: TruckAssignmentStats = useMemo(() => {
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

  const summary: TruckAssignmentSummary = useMemo(() => {
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

  const drivers = useMemo(
    () => Array.from(new Set(records.map((r) => r.driver))).sort(),
    [records]
  );

  const getStatusColor = (status: TruckAssignmentStatus) =>
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

  const handleAdd = () => {
    showNotification({
      title: 'Add assignment',
      message: 'Replace with real create flow.',
    });
  };

  const handleView = (record: TruckAssignmentRecord) => {
    showNotification({
      title: 'View assignment',
      message: `${record.truckId} — ${record.driver}`,
    });
  };

  const handleEdit = (record: TruckAssignmentRecord) => {
    showNotification({
      title: 'Edit assignment',
      message: `Open edit for ${record.truckId} (${record.plateNo}).`,
    });
  };

  const handleMarkComplete = (record: TruckAssignmentRecord) => {
    showNotification({
      title: 'Mark complete',
      message: `${record.truckId} marked as completed.`,
    });
  };

  const handleCancel = (record: TruckAssignmentRecord) => {
    showNotification({
      color: 'red',
      title: 'Assignment cancelled',
      message: `${record.truckId} cancelled.`,
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
    },
    actions: {
      handleImport,
      handleExport,
      handleAdd,
      handleView,
      handleEdit,
      handleMarkComplete,
      handleCancel,
    },
    getStatusColor,
  };
}
