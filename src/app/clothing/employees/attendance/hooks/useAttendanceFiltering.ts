import { useMemo } from 'react';
import type { AttendanceRecord, AttendanceStatus } from '../types';
import { toDate } from '@/utils/date';

export function useAttendanceFiltering(
  records: AttendanceRecord[],
  searchQuery: string,
  statusFilter: 'all' | AttendanceStatus,
  yearFilter: string
) {
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const dateDifference =
        (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0);
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

      const recordYear = (toDate(record.date)?.getFullYear() ?? -1).toString();
      const matchesYear = recordYear === yearFilter;

      return matchesSearch && matchesStatus && matchesYear;
    });
  }, [sortedRecords, searchQuery, statusFilter, yearFilter]);

  const stats = useMemo(() => {
    const totalRecords = filteredRecords.length;
    const presentCount = filteredRecords.filter(
      (record) => record.status === 'present'
    ).length;
    const lateCount = filteredRecords.filter(
      (record) => record.status === 'late'
    ).length;
    const absentCount = filteredRecords.filter(
      (record) => record.status === 'absent'
    ).length;
    const onLeaveCount = filteredRecords.filter(
      (record) => record.status === 'on-leave'
    ).length;
    const totalHours = filteredRecords.reduce(
      (sum, record) => sum + record.totalHours,
      0
    );

    return {
      totalRecords,
      presentCount,
      lateCount,
      absentCount,
      onLeaveCount,
      totalHours,
      averageHours: totalRecords ? totalHours / totalRecords : 0,
    };
  }, [filteredRecords]);

  return {
    sortedRecords,
    filteredRecords,
    ...stats,
  };
}
