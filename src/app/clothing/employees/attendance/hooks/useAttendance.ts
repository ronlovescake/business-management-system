import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { showNotification } from '@mantine/notifications';
import { queryKeys } from '@/lib/queryKeys';
import {
  showError,
  showSuccess,
  showDeleteConfirm,
  getSwal,
} from '@/lib/alerts';
import { formatTimeString } from '@/utils/dateFormatters';
import type {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceFormValues,
} from '../types';
import { formatDisplayDate, getCurrentDateISO } from '@/utils/date';
import {
  AUTO_RECORD_LOOKBACK_DAYS,
  calculateTotalHours,
  createEmptyFormValues,
  getAutoRecordDateRange,
} from './attendanceHookUtils';
import { useAttendanceFiltering } from './useAttendanceFiltering';
import {
  buildAttendanceCsv,
  parseImportedAttendanceCsv,
} from './attendanceCsvUtils';
import { prepareAutoRecordAttendance } from './attendanceAutoRecordUtils';

const formatTime = formatTimeString;

export function useAttendance(apiBasePath?: string) {
  const queryClient = useQueryClient();
  const currentYear = String(new Date().getFullYear());

  const resolveApiPath = useCallback(
    (path: string) => buildApiPath(apiBasePath, path),
    [apiBasePath]
  );

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordForm, setRecordForm] = useState<AttendanceFormValues>(
    createEmptyFormValues()
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>(
    'all'
  );
  const [yearFilter, setYearFilter] = useState(currentYear);

  const yearOptions = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        String(Number(currentYear) - 1 + index)
      ),
    [currentYear]
  );

  // Query filters object for cache key
  const filters = useMemo(
    () => ({ search: searchQuery, status: statusFilter }),
    [searchQuery, statusFilter]
  );

  const attendanceQueryKey = useMemo(
    () => [...queryKeys.attendance.lists(), { filters, apiBasePath }],
    [filters, apiBasePath]
  );

  // Fetch attendance records with React Query
  const {
    data: records = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: attendanceQueryKey,
    queryFn: async () => {
      const data = await api.get<AttendanceRecord[]>(
        resolveApiPath('/attendance')
      );
      return data || [];
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  // Log errors
  if (error) {
    logger.error('Error fetching attendance:', error);
    showNotification({
      color: 'red',
      title: 'Error',
      message: 'Failed to fetch attendance records',
    });
  }

  const {
    filteredRecords,
    totalRecords,
    presentCount,
    lateCount,
    absentCount,
    onLeaveCount,
    totalHours,
    averageHours,
  } = useAttendanceFiltering(records, searchQuery, statusFilter, yearFilter);

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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${resolveApiPath('/attendance')}?id=${id}`);
      return id;
    },
    onMutate: async (deletedId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: attendanceQueryKey,
      });

      // Snapshot previous value
      const previous =
        queryClient.getQueryData<AttendanceRecord[]>(attendanceQueryKey);

      // Optimistically remove from cache
      if (previous) {
        queryClient.setQueryData<AttendanceRecord[]>(
          attendanceQueryKey,
          previous.filter((record) => record.id !== deletedId)
        );
      }

      return { previous };
    },
    onError: (error, deletedId, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(attendanceQueryKey, context.previous);
      }
      logger.error('Error deleting attendance:', error);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to delete attendance record',
      });
    },
    onSuccess: () => {
      showNotification({
        color: 'green',
        title: 'Deleted',
        message: 'Attendance record deleted successfully',
      });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: attendanceQueryKey });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: AttendanceStatus;
    }) => {
      const updated = await api.patch<AttendanceRecord>(
        resolveApiPath('/attendance'),
        {
          id,
          status,
        }
      );
      return updated;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({
        queryKey: attendanceQueryKey,
      });

      const previous =
        queryClient.getQueryData<AttendanceRecord[]>(attendanceQueryKey);

      // Optimistically update
      if (previous) {
        queryClient.setQueryData<AttendanceRecord[]>(
          attendanceQueryKey,
          previous.map((record) =>
            record.id === id ? { ...record, status } : record
          )
        );
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(attendanceQueryKey, context.previous);
      }
      logger.error('Error updating status:', error);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to update status',
      });
    },
    onSuccess: () => {
      showNotification({
        color: 'green',
        title: 'Updated',
        message: 'Status updated successfully',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: attendanceQueryKey });
    },
  });

  // Create single record mutation (manual entry)
  const createRecordMutation = useMutation({
    mutationFn: async (payload: Omit<AttendanceRecord, 'id'>) => {
      const saved = await api.post<AttendanceRecord>(
        resolveApiPath('/attendance'),
        payload
      );
      return saved;
    },
    onMutate: async (newRecord) => {
      await queryClient.cancelQueries({
        queryKey: attendanceQueryKey,
      });

      const previous =
        queryClient.getQueryData<AttendanceRecord[]>(attendanceQueryKey);

      // Optimistically add with temp ID
      if (previous) {
        queryClient.setQueryData<AttendanceRecord[]>(attendanceQueryKey, [
          { ...newRecord, id: 'temp-' + Date.now() } as AttendanceRecord,
          ...previous,
        ]);
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(attendanceQueryKey, context.previous);
      }
      logger.error('Error saving attendance:', error);
      showNotification({
        color: 'red',
        title: 'Error',
        message: 'Failed to save attendance record',
      });
    },
    onSuccess: (saved, variables) => {
      setRecordForm(createEmptyFormValues());
      setIsRecordModalOpen(false);

      const statusLabel =
        variables.status === 'on-leave'
          ? 'On Leave'
          : variables.status.charAt(0).toUpperCase() +
            variables.status.slice(1);

      showNotification({
        color: 'green',
        title: 'Attendance recorded',
        message: `${variables.employeeName} marked as ${statusLabel}.`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: attendanceQueryKey });
    },
  });

  // Bulk create mutation (auto-record from schedules)
  const bulkCreateMutation = useMutation({
    mutationFn: async (payload: Array<Omit<AttendanceRecord, 'id'>>) => {
      const result = await api.post<{ records: AttendanceRecord[] }>(
        resolveApiPath('/attendance'),
        payload
      );
      return result.records || [];
    },
    onMutate: async (newRecords) => {
      await queryClient.cancelQueries({
        queryKey: attendanceQueryKey,
      });

      const previous =
        queryClient.getQueryData<AttendanceRecord[]>(attendanceQueryKey);

      // Optimistically add bulk records
      if (previous) {
        const tempRecords = newRecords.map((record, index) => ({
          ...record,
          id: `temp-${Date.now()}-${index}`,
        })) as AttendanceRecord[];

        queryClient.setQueryData<AttendanceRecord[]>(attendanceQueryKey, [
          ...previous,
          ...tempRecords,
        ]);
      }

      return { previous };
    },
    onError: async (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(attendanceQueryKey, context.previous);
      }
      logger.error('Error auto-recording attendance:', error);
      const Swal = await getSwal();
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to record attendance automatically',
        allowOutsideClick: false,
      });
    },
    onSuccess: async (savedRecords, variables) => {
      const Swal = await getSwal();
      const dateRange = getAutoRecordDateRange();
      const todayISO = dateRange[0];
      const oldestDateISO = dateRange[dateRange.length - 1];

      const presentCount = variables.filter(
        (r) => r.status === 'present'
      ).length;
      const onLeaveCount = variables.filter(
        (r) => r.status === 'on-leave'
      ).length;

      const dateSummaries = dateRange
        .map((date) => ({
          date,
          count: variables.filter((r) => r.date === date).length,
        }))
        .filter((entry) => entry.count > 0);

      const summaryList =
        dateSummaries.length > 0
          ? dateSummaries
              .map(
                ({ date, count }) =>
                  `<li><strong>${date}:</strong> ${count} record${count === 1 ? '' : 's'}</li>`
              )
              .join('')
          : '<li>No new records were created.</li>';

      Swal.fire({
        icon: 'success',
        title: 'Attendance Recorded!',
        html: `
          <div style="text-align: left;">
            <p><strong>Successfully recorded ${variables.length} attendance records</strong></p>
            <p style="margin: 10px 0;"><strong>Coverage:</strong> ${oldestDateISO} → ${todayISO}</p>
            <ul style="margin-top: 10px;">
              ${summaryList}
              <li><strong>Status totals:</strong> ${presentCount} present, ${onLeaveCount} on leave</li>
            </ul>
          </div>
        `,
        allowOutsideClick: false,
      });

      showNotification({
        color: 'green',
        title: 'Success',
        message: `Recorded ${variables.length} attendance records`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: attendanceQueryKey });
    },
  });

  const handleDeleteRecord = async (id: string) => {
    const confirmed = await showDeleteConfirm('this attendance record');
    if (confirmed) {
      deleteMutation.mutate(id);
    }
  };

  const handleMarkStatus = async (id: string, status: AttendanceStatus) => {
    updateStatusMutation.mutate({ id, status });
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
    const Swal = await getSwal();
    // Show confirmation dialog
    const lookbackDescription =
      AUTO_RECORD_LOOKBACK_DAYS === 1
        ? 'today only'
        : `today plus the previous ${AUTO_RECORD_LOOKBACK_DAYS - 1} days`;

    const result = await Swal.fire({
      title: 'Record Attendance',
      html: `
        <div style="text-align: left;">
          <p>Do you want to automatically record attendance based on schedules?</p>
          <ul style="margin-top: 10px;">
            <li><strong>Coverage:</strong> Record attendance for ${lookbackDescription}</li>
            <li><strong>Catch-up:</strong> Fills in any missing days in that window</li>
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
      allowOutsideClick: false,
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
    const Swal = await getSwal();
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

      // Build the rolling window of dates (today + previous days)
      const dateRange = getAutoRecordDateRange();
      const todayISO = dateRange[0];
      const oldestDateISO = dateRange[dateRange.length - 1];
      // Fetch all schedules
      const allSchedules = await api.get<
        Array<{
          employeeId: string;
          employeeName: string;
          department: string;
          position: string;
          date: string;
          startTime: string;
          break1?: string | null;
          lunch?: string | null;
          break2?: string | null;
          endTime: string;
          status: string;
          notes?: string;
        }>
      >(resolveApiPath('/schedules'));

      const existingAttendance = await api.get<
        Array<{ employeeId: string; date: string }>
      >(
        `${resolveApiPath('/attendance')}?startDate=${oldestDateISO}&endDate=${todayISO}`
      );

      const allLeaveRequests = await api.get<
        Array<{
          employeeId: string;
          status: string;
          startDate: string;
          endDate: string;
          leaveType: string;
          reason: string;
        }>
      >(resolveApiPath('/leave-requests'));

      const preparedResult = prepareAutoRecordAttendance({
        allSchedules,
        existingAttendance,
        allLeaveRequests,
        dateRange,
      });

      if (preparedResult.kind === 'no-schedules') {
        Swal.fire({
          icon: 'info',
          title: 'No Schedules Found',
          text: `No employee schedules found from ${preparedResult.oldestDateISO} through ${preparedResult.todayISO}`,
          allowOutsideClick: false,
        });
        return;
      }

      if (preparedResult.kind === 'already-recorded') {
        Swal.fire({
          icon: 'info',
          title: 'Already Recorded',
          text: `All employees with schedules between ${preparedResult.oldestDateISO} and ${preparedResult.todayISO} already have attendance records.`,
          allowOutsideClick: false,
        });
        return;
      }

      bulkCreateMutation.mutate(preparedResult.newAttendanceRecords);
    } catch (error) {
      logger.error('Error in auto-record attendance:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to process automatic attendance recording',
        allowOutsideClick: false,
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

    createRecordMutation.mutate(newRecord);
  };

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = await parseImportedAttendanceCsv(text);
        if (!parsed) {
          return;
        }

        const { importedRecords, successCount, errors } = parsed;

        if (importedRecords.length > 0) {
          // Use bulk mutation
          try {
            bulkCreateMutation.mutate(importedRecords);
            await showSuccess(
              `Successfully imported ${successCount} attendance records`,
              'Import Successful'
            );
          } catch (error) {
            logger.error('Error saving imported records:', error);
            await showError(
              'Failed to save imported records to database. Error: ' +
                (error instanceof Error ? error.message : String(error)),
              'Import Failed'
            );
          }
        }

        if (errors.length > 0 && errors.length <= 10) {
          logger.error('Import errors:', errors);
        }
      } catch (error) {
        logger.error('CSV import error:', error);
        await showError(
          'Failed to import CSV file. Please check the file format.',
          'Import Error'
        );
      }
    };

    reader.onerror = async () => {
      await showError('Failed to read CSV file', 'File Read Error');
    };

    reader.readAsText(file);
  };

  const handleExportCSV = async () => {
    if (filteredRecords.length === 0) {
      await showError('No attendance records to export', 'Export Error');
      return;
    }

    const csvContent = buildAttendanceCsv(filteredRecords);

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
    yearFilter,
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
    yearOptions,

    // Setters
    setSearchQuery,
    setStatusFilter,
    setYearFilter,

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
