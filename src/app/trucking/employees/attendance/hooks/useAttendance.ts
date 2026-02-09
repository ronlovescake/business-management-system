import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import { showNotification } from '@mantine/notifications';
import Swal from 'sweetalert2';
import { queryKeys } from '@/lib/queryKeys';
import { showError, showSuccess, showDeleteConfirm } from '@/lib/alerts';
import { formatTimeString } from '@/utils/dateFormatters';
import type {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceFormValues,
} from '../types';
import { getCurrentDateISO, formatDisplayDate, toDate } from '@/utils/date';

const formatTime = formatTimeString;
const AUTO_RECORD_LOOKBACK_DAYS: number = 15;
const getAutoRecordDateRange = () =>
  Array.from({ length: AUTO_RECORD_LOOKBACK_DAYS }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return date.toISOString().split('T')[0];
  });

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
  const queryClient = useQueryClient();

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordForm, setRecordForm] = useState<AttendanceFormValues>(
    createEmptyFormValues()
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>(
    'all'
  );

  // Query filters object for cache key
  const filters = useMemo(
    () => ({ search: searchQuery, status: statusFilter }),
    [searchQuery, statusFilter]
  );

  // Fetch attendance records with React Query
  const {
    data: records = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.attendance.list(filters),
    queryFn: async () => {
      const data = await api.get<AttendanceRecord[]>(
        '/api/trucking/attendance'
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/trucking/attendance?id=${id}`);
      return id;
    },
    onMutate: async (deletedId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.attendance.lists(),
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData<AttendanceRecord[]>(
        queryKeys.attendance.list(filters)
      );

      // Optimistically remove from cache
      if (previous) {
        queryClient.setQueryData<AttendanceRecord[]>(
          queryKeys.attendance.list(filters),
          previous.filter((record) => record.id !== deletedId)
        );
      }

      return { previous };
    },
    onError: (error, deletedId, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.attendance.list(filters),
          context.previous
        );
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
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.lists() });
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
        '/api/trucking/attendance',
        {
          id,
          status,
        }
      );
      return updated;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.attendance.lists(),
      });

      const previous = queryClient.getQueryData<AttendanceRecord[]>(
        queryKeys.attendance.list(filters)
      );

      // Optimistically update
      if (previous) {
        queryClient.setQueryData<AttendanceRecord[]>(
          queryKeys.attendance.list(filters),
          previous.map((record) =>
            record.id === id ? { ...record, status } : record
          )
        );
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.attendance.list(filters),
          context.previous
        );
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
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.lists() });
    },
  });

  // Create single record mutation (manual entry)
  const createRecordMutation = useMutation({
    mutationFn: async (payload: Omit<AttendanceRecord, 'id'>) => {
      const saved = await api.post<AttendanceRecord>(
        '/api/trucking/attendance',
        payload
      );
      return saved;
    },
    onMutate: async (newRecord) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.attendance.lists(),
      });

      const previous = queryClient.getQueryData<AttendanceRecord[]>(
        queryKeys.attendance.list(filters)
      );

      // Optimistically add with temp ID
      if (previous) {
        queryClient.setQueryData<AttendanceRecord[]>(
          queryKeys.attendance.list(filters),
          [
            { ...newRecord, id: 'temp-' + Date.now() } as AttendanceRecord,
            ...previous,
          ]
        );
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.attendance.list(filters),
          context.previous
        );
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
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.lists() });
    },
  });

  // Bulk create mutation (auto-record from schedules)
  const bulkCreateMutation = useMutation({
    mutationFn: async (payload: Array<Omit<AttendanceRecord, 'id'>>) => {
      const result = await api.post<{ records: AttendanceRecord[] }>(
        '/api/trucking/attendance',
        payload
      );
      return result.records || [];
    },
    onMutate: async (newRecords) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.attendance.lists(),
      });

      const previous = queryClient.getQueryData<AttendanceRecord[]>(
        queryKeys.attendance.list(filters)
      );

      // Optimistically add bulk records
      if (previous) {
        const tempRecords = newRecords.map((record, index) => ({
          ...record,
          id: `temp-${Date.now()}-${index}`,
        })) as AttendanceRecord[];

        queryClient.setQueryData<AttendanceRecord[]>(
          queryKeys.attendance.list(filters),
          [...previous, ...tempRecords]
        );
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.attendance.list(filters),
          context.previous
        );
      }
      logger.error('Error auto-recording attendance:', error);
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
    onSuccess: (savedRecords, variables) => {
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
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.lists() });
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
      const recentDateSet = new Set(dateRange);

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
      >('/api/trucking/schedules');

      // Filter schedules for the rolling window that are not cancelled
      const relevantSchedules = allSchedules.filter(
        (schedule: { date: string; status: string }) =>
          recentDateSet.has(schedule.date) && schedule.status !== 'cancelled'
      );

      if (relevantSchedules.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'No Schedules Found',
          text: `No employee schedules found from ${oldestDateISO} through ${todayISO}`,
          allowOutsideClick: false,
        });
        return;
      }

      // Fetch existing attendance for the entire lookback window
      const existingAttendance = await api.get<
        Array<{ employeeId: string; date: string }>
      >(
        `/api/trucking/attendance?startDate=${oldestDateISO}&endDate=${todayISO}`
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
          text: `All employees with schedules between ${oldestDateISO} and ${todayISO} already have attendance records.`,
          allowOutsideClick: false,
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
      const calculateHours = (
        startTime: string,
        endTime: string,
        breakMinutes = 0
      ) => {
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);

        const startMinutes = startHour * 60 + startMin;
        let endMinutes = endHour * 60 + endMin;

        // Handle overnight shifts
        if (endMinutes < startMinutes) {
          endMinutes += 24 * 60;
        }

        const totalMinutes = endMinutes - startMinutes;
        const workMinutes = totalMinutes - breakMinutes;

        return Math.max(0, workMinutes / 60);
      };

      const addMinutesToTime = (time: string, minutesToAdd: number) => {
        if (!time) {
          return undefined;
        }

        const [hourStr, minuteStr] = time.split(':');
        const hours = Number(hourStr);
        const minutes = Number(minuteStr);

        if (Number.isNaN(hours) || Number.isNaN(minutes)) {
          return undefined;
        }

        let totalMinutes = hours * 60 + minutes + minutesToAdd;
        totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;

        const nextHours = Math.floor(totalMinutes / 60);
        const nextMinutes = totalMinutes % 60;

        return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
      };

      const resolveBreakWindow = (
        value: string | null | undefined,
        fallback: string,
        durationMinutes: number
      ) => {
        const normalized = value?.trim() || '';
        const start = normalized || fallback;

        if (!start) {
          return {
            start: undefined as string | undefined,
            end: undefined as string | undefined,
            minutes: 0,
          };
        }

        const end = addMinutesToTime(start, durationMinutes);

        return {
          start,
          end,
          minutes: end ? durationMinutes : 0,
        };
      };

      const DEFAULT_BREAKS = {
        break1: '09:00',
        lunch: '12:00',
        break2: '15:00',
      } as const;

      const BREAK_DURATIONS = {
        break1: 15,
        lunch: 60,
        break2: 15,
      } as const;

      // Generate attendance records
      const newAttendanceRecords = schedulesNeedingAttendance.map(
        (schedule: {
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
        }) => {
          const onLeave = isOnLeave(schedule.employeeId, schedule.date);
          const leaveInfo = getLeaveInfo(schedule.employeeId, schedule.date);

          let status: AttendanceStatus = 'present';
          if (onLeave || schedule.status === 'on-leave') {
            status = 'on-leave';
          }

          const break1Window = resolveBreakWindow(
            schedule.break1,
            DEFAULT_BREAKS.break1,
            BREAK_DURATIONS.break1
          );
          const lunchWindow = resolveBreakWindow(
            schedule.lunch,
            DEFAULT_BREAKS.lunch,
            BREAK_DURATIONS.lunch
          );
          const break2Window = resolveBreakWindow(
            schedule.break2,
            DEFAULT_BREAKS.break2,
            BREAK_DURATIONS.break2
          );

          const totalBreakMinutes = [
            break1Window,
            lunchWindow,
            break2Window,
          ].reduce((sum, window) => sum + window.minutes, 0);

          const totalHours = calculateHours(
            schedule.startTime,
            schedule.endTime,
            totalBreakMinutes
          );

          return {
            employeeId: schedule.employeeId,
            employeeName: schedule.employeeName,
            department: schedule.department,
            position: schedule.position,
            date: schedule.date,
            timeIn: schedule.startTime,
            timeOut: schedule.endTime,
            break1Start: break1Window.start,
            break1End: break1Window.end,
            lunchStart: lunchWindow.start,
            lunchEnd: lunchWindow.end,
            break2Start: break2Window.start,
            break2End: break2Window.end,
            totalHours: totalHours,
            status: status,
            details: leaveInfo ? `On ${leaveInfo.leaveType}` : '',
            notes: leaveInfo
              ? `Leave period: ${leaveInfo.startDate} to ${leaveInfo.endDate}. Reason: ${leaveInfo.reason}`
              : schedule.notes || '',
          };
        }
      );

      // Use bulk mutation
      bulkCreateMutation.mutate(newAttendanceRecords);
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
        const lines = text.split('\n').filter((line) => line.trim());

        if (lines.length < 2) {
          await showError('CSV file is empty or invalid', 'Import Error');
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
          await showError(
            `Missing required columns: ${missingColumns.join(', ')}\n\n` +
              'Required columns: employeeId, employeeName, date\n' +
              'Optional columns: timeIn, timeOut, department, position, status, ' +
              'break1Start, break1End, lunchStart, lunchEnd, break2Start, break2End, ' +
              'totalHours, details, notes',
            'Import Error'
          );
          return;
        }

        const importedRecords: Array<Omit<AttendanceRecord, 'id'>> = [];
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

            const newRecord = {
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
