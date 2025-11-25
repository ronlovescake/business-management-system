import { useMemo, useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import { showNotification } from '@mantine/notifications';
import Swal from 'sweetalert2';
import type {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceFormValues,
} from '../types';
import { getCurrentDateISO, formatDisplayDate, toDate } from '@/utils/date';

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

const calculateTotalHours = (timeIn: string, timeOut: string) => {
  if (!timeIn || !timeOut) {
    return null;
  }

  const [inHours, inMinutes] = timeIn.split(':').map(Number);
  const [outHours, outMinutes] = timeOut.split(':').map(Number);

  if (
    [inHours, inMinutes, outHours, outMinutes].some((value) =>
      Number.isNaN(value)
    )
  ) {
    return null;
  }

  const start = inHours * 60 + inMinutes;
  const end = outHours * 60 + outMinutes;
  const diff = end - start;

  if (diff <= 0) {
    return null;
  }

  return diff / 60;
};

const createEmptyFormValues = (): AttendanceFormValues => ({
  employeeId: '',
  employeeName: '',
  department: '',
  position: '',
  date: getCurrentDateISO(),
  timeIn: '',
  timeOut: '',
  break1Start: '',
  break1End: '',
  lunchStart: '',
  lunchEnd: '',
  break2Start: '',
  break2End: '',
  totalHours: '',
  status: 'present',
  details: '',
  notes: '',
});

export function useAttendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordForm, setRecordForm] = useState<AttendanceFormValues>(
    createEmptyFormValues()
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>(
    'all'
  );

  // Fetch attendance records from the database
  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setIsLoading(true);
        const data = await api.get<AttendanceRecord[]>(
          '/api/trucking/attendance'
        );
        setRecords(data || []);
      } catch (error) {
        logger.error('Error fetching attendance:', error);
        showNotification({
          color: 'red',
          title: 'Error',
          message: 'Failed to fetch attendance records',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendance();
  }, []);

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

  const formatDate = (dateString: string) =>
    formatDisplayDate(dateString, 'MMM D, YYYY');

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

  const handleDeleteRecord = async (id: string) => {
    if (confirm('Are you sure you want to delete this attendance record?')) {
      try {
        await api.delete(`/api/trucking/attendance?id=${id}`);

        setRecords((prev) => prev.filter((record) => record.id !== id));

        showNotification({
          color: 'green',
          title: 'Deleted',
          message: 'Attendance record deleted successfully',
        });
      } catch (error) {
        logger.error('Error deleting attendance:', error);
        showNotification({
          color: 'red',
          title: 'Error',
          message: 'Failed to delete attendance record',
        });
      }
    }
  };

  const handleMarkStatus = async (id: string, status: AttendanceStatus) => {
    try {
      const updated = await api.patch<AttendanceRecord>(
        '/api/trucking/attendance',
        {
          id,
          status,
        }
      );

      setRecords((prev) =>
        prev.map((record) => (record.id === id ? updated : record))
      );

      showNotification({
        color: 'green',
        title: 'Updated',
        message: 'Status updated successfully',
      });
    } catch (error) {
      logger.error('Error updating status:', error);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to update status',
      });
    }
  };

  const updateRecordForm = <K extends keyof AttendanceFormValues>(
    field: K,
    value: AttendanceFormValues[K]
  ) => {
    setRecordForm((prev) => {
      const next = {
        ...prev,
        [field]: value,
      } as AttendanceFormValues;

      if (field === 'timeIn' || field === 'timeOut') {
        if (next.timeIn && next.timeOut) {
          const computed = calculateTotalHours(next.timeIn, next.timeOut);
          next.totalHours = computed ? computed.toFixed(2) : '';
        } else {
          next.totalHours = '';
        }
      }

      return next;
    });
  };

  const handleAddRecord = async () => {
    // Show confirmation dialog
    const result = await Swal.fire({
      title: 'Record Attendance',
      html: `
        <div style="text-align: left;">
          <p>Do you want to automatically record attendance based on schedules?</p>
          <ul style="margin-top: 10px;">
            <li><strong>Primary:</strong> Record attendance for today</li>
            <li><strong>Catch-up:</strong> Also record yesterday if missing</li>
            <li>Check for approved leave requests</li>
            <li>Use schedule times for time-in/time-out</li>
          </ul>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Record Automatically',
      cancelButtonText: 'Manual Entry',
      confirmButtonColor: '#228be6',
      cancelButtonColor: '#868e96',
      reverseButtons: true,
    });

    if (result.isConfirmed) {
      // User wants automatic recording
      await handleAutoRecordAttendance();
    } else if (result.dismiss === Swal.DismissReason.cancel) {
      // User wants manual entry
      setRecordForm(createEmptyFormValues());
      setIsRecordModalOpen(true);
    }
  };

  const handleAutoRecordAttendance = async () => {
    try {
      // Show loading
      Swal.fire({
        title: 'Processing...',
        text: 'Checking schedules and generating attendance records',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      // Get today's and yesterday's dates
      const today = new Date();
      const todayISO = today.toISOString().split('T')[0];

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayISO = yesterday.toISOString().split('T')[0];

      // Fetch all schedules
      const allSchedules = await api.get<
        Array<{
          employeeId: string;
          employeeName: string;
          department: string;
          position: string;
          date: string;
          startTime: string;
          endTime: string;
          status: string;
          notes?: string;
        }>
      >('/api/trucking/schedules');

      // Filter schedules for today and yesterday that are not cancelled
      const relevantSchedules = allSchedules.filter(
        (schedule: { date: string; status: string }) =>
          (schedule.date === todayISO || schedule.date === yesterdayISO) &&
          schedule.status !== 'cancelled'
      );

      if (relevantSchedules.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'No Schedules Found',
          text: `No employee schedules found for today (${todayISO}) or yesterday (${yesterdayISO})`,
        });
        return;
      }

      // Fetch existing attendance for today and yesterday
      const existingAttendance = await api.get<
        Array<{ employeeId: string; date: string }>
      >(
        `/api/trucking/attendance?startDate=${yesterdayISO}&endDate=${todayISO}`
      );

      // Create a map of existing attendance by employeeId and date
      const existingAttendanceMap = new Map<string, Set<string>>();
      existingAttendance.forEach((a: { employeeId: string; date: string }) => {
        if (!existingAttendanceMap.has(a.employeeId)) {
          existingAttendanceMap.set(a.employeeId, new Set());
        }
        existingAttendanceMap.get(a.employeeId)?.add(a.date);
      });

      // Filter schedules for employees without attendance for that specific date
      const schedulesNeedingAttendance = relevantSchedules.filter(
        (schedule: { employeeId: string; date: string }) => {
          const employeeDates = existingAttendanceMap.get(schedule.employeeId);
          return !employeeDates || !employeeDates.has(schedule.date);
        }
      );

      if (schedulesNeedingAttendance.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'Already Recorded',
          text: `All employees with schedules for today and yesterday already have attendance records.`,
        });
        return;
      }

      // Fetch leave requests
      const allLeaveRequests = await api.get<
        Array<{
          employeeId: string;
          status: string;
          startDate: string;
          endDate: string;
          leaveType: string;
          reason: string;
        }>
      >('/api/trucking/leave-requests');

      // Helper function to check if employee is on leave
      const isOnLeave = (employeeId: string, date: string) => {
        return allLeaveRequests.some(
          (request: {
            employeeId: string;
            status: string;
            startDate: string;
            endDate: string;
          }) => {
            const requestId = String(request.employeeId || '')
              .trim()
              .toLowerCase();
            const scheduleId = String(employeeId || '')
              .trim()
              .toLowerCase();

            if (requestId !== scheduleId) {
              return false;
            }
            if (request.status !== 'approved') {
              return false;
            }

            return date >= request.startDate && date <= request.endDate;
          }
        );
      };

      // Helper function to get leave info
      const getLeaveInfo = (employeeId: string, date: string) => {
        return allLeaveRequests.find(
          (request: {
            employeeId: string;
            status: string;
            startDate: string;
            endDate: string;
            leaveType: string;
            reason: string;
          }) => {
            const requestId = String(request.employeeId || '')
              .trim()
              .toLowerCase();
            const scheduleId = String(employeeId || '')
              .trim()
              .toLowerCase();
            return (
              requestId === scheduleId &&
              request.status === 'approved' &&
              date >= request.startDate &&
              date <= request.endDate
            );
          }
        );
      };

      // Helper function to calculate total hours
      const calculateHours = (startTime: string, endTime: string) => {
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);

        const startMinutes = startHour * 60 + startMin;
        let endMinutes = endHour * 60 + endMin;

        // Handle overnight shifts
        if (endMinutes < startMinutes) {
          endMinutes += 24 * 60;
        }

        const totalMinutes = endMinutes - startMinutes;
        const workMinutes = totalMinutes - 90; // Deduct breaks (90 min)

        return Math.max(0, workMinutes / 60);
      };

      // Generate attendance records
      const newAttendanceRecords = schedulesNeedingAttendance.map(
        (schedule: {
          employeeId: string;
          employeeName: string;
          department: string;
          position: string;
          date: string;
          startTime: string;
          endTime: string;
          status: string;
          notes?: string;
        }) => {
          const onLeave = isOnLeave(schedule.employeeId, schedule.date);
          const leaveInfo = getLeaveInfo(schedule.employeeId, schedule.date);

          let status: AttendanceStatus = 'present';
          if (onLeave || schedule.status === 'on-leave') {
            status = 'on-leave';
          }

          const totalHours = calculateHours(
            schedule.startTime,
            schedule.endTime
          );

          return {
            employeeId: schedule.employeeId,
            employeeName: schedule.employeeName,
            department: schedule.department,
            position: schedule.position,
            date: schedule.date,
            timeIn: schedule.startTime,
            timeOut: schedule.endTime,
            break1Start: '09:00',
            break1End: '09:15',
            lunchStart: '12:00',
            lunchEnd: '13:00',
            break2Start: '15:00',
            break2End: '15:15',
            totalHours: totalHours,
            status: status,
            details: leaveInfo ? `On ${leaveInfo.leaveType}` : '',
            notes: leaveInfo
              ? `Leave period: ${leaveInfo.startDate} to ${leaveInfo.endDate}. Reason: ${leaveInfo.reason}`
              : schedule.notes || '',
          };
        }
      );

      // Save to database
      const savedData = await api.post<{ records: AttendanceRecord[] }>(
        '/api/trucking/attendance',
        newAttendanceRecords
      );
      const savedRecords = savedData.records || [];

      // Update local state
      setRecords((prev) => [...prev, ...savedRecords]);

      // Count statuses and dates
      const presentCount = newAttendanceRecords.filter(
        (r: { status: string }) => r.status === 'present'
      ).length;
      const onLeaveCount = newAttendanceRecords.filter(
        (r: { status: string }) => r.status === 'on-leave'
      ).length;

      const todayRecords = newAttendanceRecords.filter(
        (r: { date: string }) => r.date === todayISO
      ).length;
      const yesterdayRecords = newAttendanceRecords.filter(
        (r: { date: string }) => r.date === yesterdayISO
      ).length;

      // Show success message
      Swal.fire({
        icon: 'success',
        title: 'Attendance Recorded!',
        html: `
          <div style="text-align: left;">
            <p><strong>Successfully recorded ${newAttendanceRecords.length} attendance records</strong></p>
            <ul style="margin-top: 10px;">
              <li><strong>Today (${todayISO}):</strong> ${todayRecords} records</li>
              ${yesterdayRecords > 0 ? `<li><strong>Yesterday (${yesterdayISO}):</strong> ${yesterdayRecords} records (catch-up)</li>` : ''}
              <li><strong>Status:</strong> ${presentCount} present, ${onLeaveCount} on leave</li>
            </ul>
          </div>
        `,
      });

      showNotification({
        color: 'green',
        title: 'Success',
        message: `Recorded ${newAttendanceRecords.length} attendance records`,
      });
    } catch (error) {
      logger.error('Error auto-recording attendance:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to record attendance automatically',
      });
    }
  };

  const handleCloseRecordModal = () => {
    setIsRecordModalOpen(false);
  };

  const handleSaveRecord = async () => {
    const trimmedName = recordForm.employeeName.trim();
    const trimmedId = recordForm.employeeId.trim();

    if (!trimmedName || !trimmedId || !recordForm.date) {
      showNotification({
        color: 'red',
        title: 'Incomplete details',
        message: 'Employee name, employee ID, and date are required.',
      });
      return;
    }

    const computedFromTimes = calculateTotalHours(
      recordForm.timeIn,
      recordForm.timeOut
    );

    const parsedTotalHours = recordForm.totalHours
      ? parseFloat(recordForm.totalHours)
      : 0;

    const totalHours = computedFromTimes
      ? parseFloat(computedFromTimes.toFixed(2))
      : Number.isNaN(parsedTotalHours)
        ? 0
        : parsedTotalHours;

    const newRecord = {
      employeeId: trimmedId,
      employeeName: trimmedName,
      department: recordForm.department.trim() || 'N/A',
      position: recordForm.position.trim() || 'N/A',
      date: recordForm.date,
      timeIn: recordForm.timeIn || '00:00',
      timeOut: recordForm.timeOut || '00:00',
      break1Start: recordForm.break1Start || undefined,
      break1End: recordForm.break1End || undefined,
      lunchStart: recordForm.lunchStart || undefined,
      lunchEnd: recordForm.lunchEnd || undefined,
      break2Start: recordForm.break2Start || undefined,
      break2End: recordForm.break2End || undefined,
      totalHours,
      status: recordForm.status,
      details: recordForm.details.trim() || '',
      notes: recordForm.notes.trim() || undefined,
    };

    try {
      const saved = await api.post<AttendanceRecord>(
        '/api/trucking/attendance',
        newRecord
      );

      setRecords((prev) => [...prev, saved]);
      setRecordForm(createEmptyFormValues());
      setIsRecordModalOpen(false);

      const statusLabel =
        recordForm.status === 'on-leave'
          ? 'On Leave'
          : recordForm.status.charAt(0).toUpperCase() +
            recordForm.status.slice(1);

      showNotification({
        color: 'green',
        title: 'Attendance recorded',
        message: `${trimmedName} marked as ${statusLabel}.`,
      });
    } catch (error) {
      logger.error('Error saving attendance:', error);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to save attendance record',
      });
    }
  };

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
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
          // Save to database via API
          try {
            const result = await api.post<{ records: AttendanceRecord[] }>(
              '/api/trucking/attendance',
              importedRecords
            );

            // Update local state with saved records
            setRecords((prev) => [...prev, ...result.records]);
            alert(
              `Successfully imported and saved ${successCount} attendance records to database`
            );
          } catch (error) {
            logger.error('Error saving imported records:', error);
            alert(
              'Failed to save imported records to database. Error: ' +
                (error instanceof Error ? error.message : String(error))
            );
          }
        }

        if (errors.length > 0 && errors.length <= 10) {
          logger.error('Import errors:', errors);
        }
      } catch (error) {
        logger.error('CSV import error:', error);
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
      `attendance_records_${getCurrentDateISO()}.csv`
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
    isRecordModalOpen,
    recordForm,
    isLoading,

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
    handleCloseRecordModal,
    handleSaveRecord,
    handleImportCSV,
    handleExportCSV,
    updateRecordForm,
  };
}
