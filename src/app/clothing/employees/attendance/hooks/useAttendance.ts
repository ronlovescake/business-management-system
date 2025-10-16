import { useMemo, useState } from 'react';
import type { AttendanceRecord, AttendanceStatus } from '../types';

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export function useAttendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([
    {
      id: '1',
      employeeId: 'EMP-0001',
      employeeName: 'Ronald Allan Balng',
      department: 'Operations',
      position: 'General Manager',
      date: '2025-10-15',
      timeIn: '08:00',
      timeOut: '17:00',
      totalHours: 8.5,
      status: 'present',
      details: 'Warehouse oversight and team briefing',
    },
    {
      id: '2',
      employeeId: 'EMP-0003',
      employeeName: 'Arnel Ephraim Subia Aliangan',
      department: 'Operations',
      position: 'Warehouse POC',
      date: '2025-10-15',
      timeIn: '08:30',
      timeOut: '17:15',
      totalHours: 7.75,
      status: 'late',
      details: 'Handled inbound shipment processing',
      notes: 'Arrived late due to traffic, approved by supervisor',
    },
    {
      id: '3',
      employeeId: 'EMP-0004',
      employeeName: 'Rain Jouel Subia Orong',
      department: 'Operations',
      position: 'Warehouse Staff',
      date: '2025-10-15',
      timeIn: '00:00',
      timeOut: '00:00',
      totalHours: 0,
      status: 'absent',
      details: 'Scheduled to assist with inventory count',
      notes: 'Marked absent - no call, no show',
    },
    {
      id: '4',
      employeeId: 'EMP-0005',
      employeeName: 'Joan Lacualan Tapic',
      department: 'Operations',
      position: 'Warehouse Staff',
      date: '2025-10-15',
      timeIn: '08:05',
      timeOut: '17:10',
      totalHours: 8.1,
      status: 'present',
      details: 'Packed outbound orders and updated stock levels',
    },
    {
      id: '5',
      employeeId: 'EMP-0002',
      employeeName: 'Czarina Cortez Balng',
      department: 'Operations',
      position: 'Co-General Manager',
      date: '2025-10-15',
      timeIn: '09:00',
      timeOut: '16:00',
      totalHours: 6,
      status: 'on-leave',
      details: 'Approved half-day leave',
      notes: 'Family medical appointment',
    },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>(
    'all'
  );

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const dateDifference =
        new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDifference !== 0) {
        return dateDifference;
      }
      return a.employeeName.localeCompare(b.employeeName);
    });
  }, [records]);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return sortedRecords.filter((record) => {
      const matchesSearch = normalizedQuery
        ? [
            record.employeeName,
            record.employeeId,
            record.department,
            record.position,
            record.details,
            record.notes,
          ]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLowerCase().includes(normalizedQuery))
        : true;

      const matchesStatus =
        statusFilter === 'all' || record.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [sortedRecords, searchQuery, statusFilter]);

  const totalRecords = records.length;
  const presentCount = records.filter(
    (record) => record.status === 'present'
  ).length;
  const lateCount = records.filter((record) => record.status === 'late').length;
  const absentCount = records.filter(
    (record) => record.status === 'absent'
  ).length;
  const onLeaveCount = records.filter(
    (record) => record.status === 'on-leave'
  ).length;

  const totalHours = records.reduce(
    (sum, record) => sum + record.totalHours,
    0
  );
  const averageHours = totalRecords ? totalHours / totalRecords : 0;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTimeRange = (timeIn: string, timeOut: string) => {
    if (timeIn === '00:00' && timeOut === '00:00') {
      return '—';
    }
    return `${formatTime(timeIn)} - ${formatTime(timeOut)}`;
  };

  const formatHours = (hours: number) => {
    if (hours === 0) {
      return '0 hrs';
    }
    return `${hours.toFixed(2)} hrs`;
  };

  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return 'green';
      case 'late':
        return 'yellow';
      case 'absent':
        return 'red';
      case 'on-leave':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const handleDeleteRecord = (id: string) => {
    if (confirm('Are you sure you want to delete this attendance record?')) {
      setRecords((prev) => prev.filter((record) => record.id !== id));
    }
  };

  const handleMarkStatus = (id: string, status: AttendanceStatus) => {
    setRecords((prev) =>
      prev.map((record) =>
        record.id === id
          ? {
              ...record,
              status,
            }
          : record
      )
    );
  };

  return {
    // State
    records,
    filteredRecords,
    searchQuery,
    statusFilter,

    // Computed values
    totalRecords,
    presentCount,
    lateCount,
    absentCount,
    onLeaveCount,
    totalHours,
    averageHours,

    // Setters
    setSearchQuery,
    setStatusFilter,

    // Utility functions
    formatDate,
    formatTimeRange,
    formatHours,
    getStatusColor,

    // Event handlers
    handleDeleteRecord,
    handleMarkStatus,
  };
}
