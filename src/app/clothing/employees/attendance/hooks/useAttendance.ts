import { useMemo, useState } from 'react';
import type { AttendanceRecord, AttendanceStatus } from '../types';

const formatTime = (time: string) => {
  // Handle empty or invalid time strings
  if (!time || time.trim() === '') {
    return '—';
  }

  const parts = time.split(':');
  if (parts.length < 2) {
    return '—';
  }

  const [hours, minutes] = parts.map(Number);

  // Validate hours and minutes
  if (
    isNaN(hours) ||
    isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return '—';
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const generateId = () =>
  `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export function useAttendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

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

  const handleAddRecord = () => {
    // This will be used to open a dialog to add a new record
    // For now, we'll just show an alert
    alert('Add attendance record dialog will be implemented soon');
  };

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter((line) => line.trim());

        if (lines.length < 2) {
          alert('CSV file is empty or invalid');
          return;
        }

        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const headers = parseCSVLine(lines[0]).map((h) =>
          h.toLowerCase().replace(/\s+/g, '')
        );

        const requiredColumns = ['employeeid', 'employeename', 'date'];
        const missingColumns = requiredColumns.filter(
          (col) => !headers.includes(col)
        );

        if (missingColumns.length > 0) {
          alert(
            `Missing required columns: ${missingColumns.join(', ')}\n\n` +
              'Required columns: employeeId, employeeName, date\n' +
              'Optional columns: timeIn, timeOut, department, position, status, ' +
              'break1Start, break1End, lunchStart, lunchEnd, break2Start, break2End, ' +
              'totalHours, details, notes'
          );
          return;
        }

        const importedRecords: AttendanceRecord[] = [];
        let successCount = 0;
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          try {
            const values = parseCSVLine(lines[i]);
            const row: Record<string, string> = {};

            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });

            if (!row.employeeid && !row.employeename && !row.date) {
              continue;
            }

            // Validate required fields (timeIn/timeOut optional for on-leave)
            if (!row.employeeid || !row.employeename || !row.date) {
              errors.push(`Row ${i + 1}: Missing required field(s)`);
              continue;
            }

            // Calculate total hours (only if timeIn and timeOut exist)
            let totalHours = 0;
            if (row.timein && row.timeout) {
              const [inHours, inMinutes] = row.timein.split(':').map(Number);
              const [outHours, outMinutes] = row.timeout.split(':').map(Number);
              const totalMinutes =
                outHours * 60 + outMinutes - (inHours * 60 + inMinutes);
              totalHours = totalMinutes > 0 ? totalMinutes / 60 : 0;
            } else if (row.totalhours) {
              // Use provided totalHours if timeIn/timeOut missing
              totalHours = parseFloat(row.totalhours) || 0;
            }

            const status =
              (row.status?.toLowerCase() as AttendanceStatus) || 'present';
            const validStatus: AttendanceStatus = [
              'present',
              'late',
              'absent',
              'on-leave',
            ].includes(status)
              ? status
              : 'present';

            const newRecord: AttendanceRecord = {
              id: row.id || generateId(),
              employeeId: row.employeeid,
              employeeName: row.employeename,
              department: row.department || 'N/A',
              position: row.position || 'N/A',
              date: row.date,
              timeIn: row.timein || '',
              timeOut: row.timeout || '',
              break1Start: row.break1start || undefined,
              break1End: row.break1end || undefined,
              lunchStart: row.lunchstart || undefined,
              lunchEnd: row.lunchend || undefined,
              break2Start: row.break2start || undefined,
              break2End: row.break2end || undefined,
              totalHours,
              status: validStatus,
              details: row.details || '',
              notes: row.notes || undefined,
            };

            importedRecords.push(newRecord);
            successCount++;
          } catch (error) {
            errors.push(`Row ${i + 1}: ${error}`);
          }
        }

        if (importedRecords.length > 0) {
          setRecords((prev) => [...prev, ...importedRecords]);
          alert(`Successfully imported ${successCount} attendance records`);
        }

        if (errors.length > 0 && errors.length <= 10) {
          console.error('Import errors:', errors);
        }
      } catch (error) {
        console.error('CSV import error:', error);
        alert('Failed to import CSV file. Please check the file format.');
      }
    };

    reader.onerror = () => {
      alert('Failed to read CSV file');
    };

    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      alert('No attendance records to export');
      return;
    }

    const headers = [
      'Employee ID',
      'Employee Name',
      'Department',
      'Position',
      'Date',
      'Time In',
      'Time Out',
      'Total Hours',
      'Status',
      'Details',
      'Notes',
    ];

    const escapeCSV = (value: string | number | null | undefined): string => {
      if (value === null || value === undefined) {
        return '';
      }
      const stringValue = String(value);
      if (
        stringValue.includes(',') ||
        stringValue.includes('"') ||
        stringValue.includes('\n')
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const rows = filteredRecords.map((record) => [
      escapeCSV(record.employeeId),
      escapeCSV(record.employeeName),
      escapeCSV(record.department),
      escapeCSV(record.position),
      escapeCSV(record.date),
      escapeCSV(record.timeIn),
      escapeCSV(record.timeOut),
      escapeCSV(record.totalHours.toFixed(2)),
      escapeCSV(record.status),
      escapeCSV(record.details),
      escapeCSV(record.notes || ''),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `attendance_records_${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    formatTime,
    formatTimeRange,
    formatHours,
    getStatusColor,

    // Event handlers
    handleDeleteRecord,
    handleMarkStatus,
    handleAddRecord,
    handleImportCSV,
    handleExportCSV,
  };
}
