import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showError } from '@/lib/alerts';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { queryKeys } from '@/lib/queryKeys';
import { getCurrentDateISO } from '@/utils/date';
import { dateFormatterShort, formatTimeString } from '@/utils/dateFormatters';
import type {
  Schedule,
  ScheduleStatus,
  ShiftType,
  RecurringRule,
  EmployeeSummary,
} from '../types';
import { DAY_LABELS, generateId, SHIFT_CONFIG } from './scheduleHookUtils';
import {
  calculateDuration,
  getTimeRange,
  hasScheduleOverlap,
} from './scheduleTimeUtils';
import {
  calculateScheduleStats,
  calculateWeeklyBreakdown,
  filterSchedules,
  sortSchedules,
} from './scheduleListUtils';
import { getEmployeeLeaveForDate as getEmployeeLeaveForDateFromList } from './scheduleLeaveUtils';
import { useScheduleFormState } from './useScheduleFormState';
import { generateSchedulesForRule } from './scheduleBulkUtils';
import {
  buildSchedulesCsv,
  parseImportedSchedulesCsv,
} from './scheduleCsvUtils';

/**
 * Custom Hook: useSchedules - React Query version
 *
 * Manages all business logic for the Schedules page:
 * - State management (schedules, filters, modals, forms)
 * - Computed values (filtered schedules, stats, weekly breakdown)
 * - Event handlers (CRUD operations, CSV import/export)
 * - Utility functions (formatters, validators)
 */
export function useSchedules(apiBasePath?: string) {
  const queryClient = useQueryClient();
  const currentYear = String(new Date().getFullYear());

  const resolveApiPath = useCallback(
    (path: string) => buildApiPath(apiBasePath, path),
    [apiBasePath]
  );

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterShiftType, setFilterShiftType] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState(currentYear);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [isImporting, setIsImporting] = useState(false);

  const {
    formEmployeeName,
    setFormEmployeeName,
    formEmployeeId,
    setFormEmployeeId,
    formDate,
    setFormDate,
    formShiftType,
    setFormShiftType,
    formStartTime,
    setFormStartTime,
    formEndTime,
    setFormEndTime,
    formPosition,
    setFormPosition,
    formDepartment,
    setFormDepartment,
    formNotes,
    setFormNotes,
    resetFormForCreate,
    populateFormFromSchedule,
  } = useScheduleFormState();

  // Filters for query keys
  const filters = useMemo(
    () => ({
      shiftType: filterShiftType,
      status: filterStatus,
    }),
    [filterShiftType, filterStatus]
  );

  const employeesQueryKey = useMemo(
    () => [...queryKeys.employees.lists(), { status: 'active', apiBasePath }],
    [apiBasePath]
  );

  const schedulesQueryKey = useMemo(
    () => [...queryKeys.schedules.lists(), { filters, apiBasePath }],
    [filters, apiBasePath]
  );

  const leaveRequestsQueryKey = useMemo(
    () => [...queryKeys.leaveRequests.lists(), { apiBasePath }],
    [apiBasePath]
  );

  // Fetch employees
  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery({
    queryKey: employeesQueryKey,
    queryFn: async () => {
      const data = await api.get<
        Array<{
          id: number | string;
          employeeId: string;
          name: string;
          position: string;
          department: string;
          employeeType?: string;
        }>
      >(`${resolveApiPath('/employees')}?status=active`);

      const transformed: EmployeeSummary[] = (data || []).map((emp) => ({
        id: String(emp.id),
        employeeId: emp.employeeId,
        name: emp.name,
        position: emp.position,
        department: emp.department,
        employeeType: emp.employeeType,
      }));

      return transformed;
    },
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch schedules
  const { data: schedules = [] } = useQuery({
    queryKey: schedulesQueryKey,
    queryFn: async () => {
      const data = await api.get<Schedule[]>(resolveApiPath('/schedules'));
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  // Fetch leave requests
  const { data: leaveRequests = [] } = useQuery({
    queryKey: leaveRequestsQueryKey,
    queryFn: async () => {
      const data = await api.get<
        Array<{
          id: string;
          employeeId: string;
          employeeName: string;
          leaveType: string;
          startDate: string;
          endDate: string;
          status: string;
        }>
      >(resolveApiPath('/leave-requests'));
      return data || [];
    },
    staleTime: 60 * 1000,
  });

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const shiftTypes: ShiftType[] = useMemo(
    () => ['morning', 'afternoon', 'night', 'full-day'],
    []
  );

  const yearOptions = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        String(Number(currentYear) - 1 + index)
      ),
    [currentYear]
  );

  const stayInEmployees = useMemo(() => {
    return new Set(
      employees
        .filter((emp) => emp.employeeType === 'stay-in')
        .map((emp) => emp.employeeId)
    );
  }, [employees]);

  const filteredSchedules = useMemo(() => {
    return filterSchedules(schedules, {
      searchQuery,
      filterShiftType,
      filterStatus,
      yearFilter,
    });
  }, [schedules, searchQuery, filterShiftType, filterStatus, yearFilter]);

  // Sort schedules by date (newest first)
  const sortedSchedules = useMemo(() => {
    return sortSchedules(filteredSchedules);
  }, [filteredSchedules]);

  // Stats
  const scheduleStats = useMemo(
    () => calculateScheduleStats(filteredSchedules),
    [filteredSchedules]
  );
  const totalSchedules = scheduleStats.total;
  const scheduledCount = scheduleStats.scheduled;
  const completedCount = scheduleStats.completed;
  const cancelledCount = scheduleStats.cancelled;

  // Weekly breakdown for analytics
  const weeklyBreakdown = useMemo(() => {
    return calculateWeeklyBreakdown(filteredSchedules);
  }, [filteredSchedules]);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return dateFormatterShort.format(date);
  };

  const formatTime = formatTimeString;

  const getStatusColor = (status: ScheduleStatus): string => {
    switch (status) {
      case 'scheduled':
        return 'blue';
      case 'completed':
        return 'green';
      case 'cancelled':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getShiftTypeColor = (shiftType: ShiftType): string => {
    switch (shiftType) {
      case 'morning':
        return 'orange';
      case 'afternoon':
        return 'yellow';
      case 'night':
        return 'indigo';
      case 'full-day':
        return 'cyan';
      default:
        return 'gray';
    }
  };

  const getEmployeeLeaveForDate = (
    employeeId: string,
    date: string
  ): { leaveType: string; status: string; employeeName: string } | null => {
    return getEmployeeLeaveForDateFromList(leaveRequests, employeeId, date);
  };

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  // Delete schedule mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${resolveApiPath('/schedules')}?id=${id}`);
      return id;
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({
        queryKey: schedulesQueryKey,
      });

      const previous = queryClient.getQueryData<Schedule[]>(
        queryKeys.schedules.list(filters)
      );

      if (previous) {
        queryClient.setQueryData<Schedule[]>(
          queryKeys.schedules.list(filters),
          previous.filter((schedule) => schedule.id !== deletedId)
        );
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.schedules.list(filters),
          context.previous
        );
      }
      logger.error('Error deleting schedule:', error);
      alert('Failed to delete schedule. Please try again.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: schedulesQueryKey });
    },
  });

  // Save schedule mutation (create or update)
  const saveScheduleMutation = useMutation({
    mutationFn: async (scheduleData: {
      data: Partial<Schedule>;
      isEdit: boolean;
      editId?: string;
    }) => {
      if (scheduleData.isEdit && scheduleData.editId) {
        // Update existing schedule
        const result = await api.patch<{ schedule: Schedule }>(
          resolveApiPath('/schedules'),
          { ...scheduleData.data, id: scheduleData.editId }
        );
        return { schedule: result.schedule, isEdit: true };
      } else {
        // Create new schedule
        const result = await api.post<{ schedules: Schedule[] }>(
          resolveApiPath('/schedules'),
          scheduleData.data
        );
        return { schedules: result.schedules, isEdit: false };
      }
    },
    onMutate: async ({ data, isEdit, editId }) => {
      await queryClient.cancelQueries({
        queryKey: schedulesQueryKey,
      });

      const previous = queryClient.getQueryData<Schedule[]>(
        queryKeys.schedules.list(filters)
      );

      if (previous) {
        if (isEdit && editId) {
          // Optimistically update existing
          queryClient.setQueryData<Schedule[]>(
            queryKeys.schedules.list(filters),
            previous.map((schedule) =>
              schedule.id === editId ? { ...schedule, ...data } : schedule
            )
          );
        } else {
          // Optimistically add new (with temp ID)
          const tempSchedule: Schedule = {
            ...data,
            id: `temp-${Date.now()}`,
            status: data.status || 'scheduled',
          } as Schedule;

          queryClient.setQueryData<Schedule[]>(
            queryKeys.schedules.list(filters),
            [tempSchedule, ...previous]
          );
        }
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.schedules.list(filters),
          context.previous
        );
      }
      logger.error('Error saving schedule:', error);
      alert('Failed to save schedule. Please try again.');
    },
    onSuccess: () => {
      setIsModalOpen(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: schedulesQueryKey });
    },
  });

  // Update status mutation (mark completed/cancelled)
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: ScheduleStatus;
    }) => {
      await api.patch(resolveApiPath('/schedules'), { id, status });
      return { id, status };
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({
        queryKey: schedulesQueryKey,
      });

      const previous = queryClient.getQueryData<Schedule[]>(
        queryKeys.schedules.list(filters)
      );

      if (previous) {
        queryClient.setQueryData<Schedule[]>(
          queryKeys.schedules.list(filters),
          previous.map((schedule) =>
            schedule.id === id ? { ...schedule, status } : schedule
          )
        );
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.schedules.list(filters),
          context.previous
        );
      }
      logger.error('Error updating schedule status:', error);
      alert('Failed to update schedule status. Please try again.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: schedulesQueryKey });
    },
  });

  // Bulk import mutation
  const bulkImportMutation = useMutation({
    mutationFn: async (importedSchedules: Schedule[]) => {
      const result = await api.post<{ schedules: Schedule[] }>(
        resolveApiPath('/schedules'),
        importedSchedules
      );
      return result.schedules;
    },
    onSuccess: (savedSchedules, importedSchedules) => {
      alert(`Successfully imported ${importedSchedules.length} schedule(s)`);
      setIsImporting(false);
    },
    onError: (error) => {
      logger.error('Error saving imported schedules:', error);
      alert(
        'Failed to save imported schedules to database. Error: ' +
          (error instanceof Error ? error.message : String(error))
      );
      setIsImporting(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: schedulesQueryKey });
    },
  });

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleAddSchedule = () => {
    setEditingSchedule(null);
    resetFormForCreate();
    setIsModalOpen(true);
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    populateFormFromSchedule(schedule);
    setIsModalOpen(true);
  };

  const handleDeleteSchedule = (id: string) => {
    deleteScheduleMutation.mutate(id);
  };

  const handleSaveSchedule = async () => {
    if (
      !formEmployeeName ||
      !formEmployeeId ||
      !formDate ||
      !formShiftType ||
      !formStartTime ||
      !formEndTime ||
      !formPosition ||
      !formDepartment
    ) {
      alert('Please fill in all required fields');
      return;
    }

    let resolvedShiftType = formShiftType as ShiftType;
    const isStayIn = stayInEmployees.has(formEmployeeId);

    if (isStayIn) {
      resolvedShiftType = 'full-day';
    }

    const shiftDefaults = SHIFT_CONFIG[resolvedShiftType];
    const resolvedStartTime = isStayIn
      ? shiftDefaults.start
      : formStartTime || shiftDefaults.start;
    const resolvedEndTime = isStayIn
      ? shiftDefaults.end
      : formEndTime || shiftDefaults.end;

    const candidateRange = getTimeRange(resolvedStartTime, resolvedEndTime);
    if (!candidateRange) {
      alert('Invalid start or end time');
      return;
    }

    if (
      hasScheduleOverlap(
        schedules,
        formEmployeeId,
        formDate,
        resolvedStartTime,
        resolvedEndTime,
        editingSchedule?.id
      )
    ) {
      alert(
        'This schedule overlaps with an existing schedule for the employee'
      );
      return;
    }

    const scheduleData: Partial<Schedule> = {
      employeeId: formEmployeeId,
      employeeName: formEmployeeName,
      date: formDate,
      shiftType: resolvedShiftType,
      startTime: resolvedStartTime,
      endTime: resolvedEndTime,
      position: formPosition,
      department: formDepartment,
      status: editingSchedule?.status || 'scheduled',
      notes: formNotes || undefined,
      source: editingSchedule?.source || 'manual',
      templateId: editingSchedule?.templateId,
      recurrenceId: editingSchedule?.recurrenceId,
      isOverride: editingSchedule?.isOverride || false,
    };

    if (editingSchedule?.source === 'recurrence') {
      const hasOverride =
        editingSchedule.date !== formDate ||
        editingSchedule.shiftType !== resolvedShiftType ||
        editingSchedule.startTime !== resolvedStartTime ||
        editingSchedule.endTime !== resolvedEndTime;

      if (hasOverride) {
        scheduleData.isOverride = true;
      }
    }

    saveScheduleMutation.mutate({
      data: scheduleData,
      isEdit: !!editingSchedule,
      editId: editingSchedule?.id,
    });
  };

  const handleMarkCompleted = (id: string) => {
    updateStatusMutation.mutate({ id, status: 'completed' });
  };

  const handleMarkCancelled = (id: string) => {
    updateStatusMutation.mutate({ id, status: 'cancelled' });
  };

  // ==========================================================================
  // BULK SCHEDULING HELPERS
  // ==========================================================================

  const upsertRecurringRule = async (
    rule: Omit<RecurringRule, 'id'> & { id?: string }
  ) => {
    const ruleId = rule.id || generateId();
    const normalizedRule: RecurringRule = { ...rule, id: ruleId };

    setRecurringRules((prev) => {
      const exists = prev.some((item) => item.id === ruleId);
      if (exists) {
        return prev.map((item) => (item.id === ruleId ? normalizedRule : item));
      }
      return [...prev, normalizedRule];
    });

    // Generate schedules for this rule
    const generatedSchedules = generateSchedulesForRule(
      normalizedRule,
      {},
      stayInEmployees
    );

    // Save schedules to database
    if (generatedSchedules.length > 0) {
      try {
        await api.post(resolveApiPath('/schedules'), generatedSchedules);
        queryClient.invalidateQueries({
          queryKey: schedulesQueryKey,
        });
      } catch (error) {
        logger.error('Error saving generated schedules:', error);
        await showError('Failed to save schedules. Please try again.');
        throw error;
      }
    }

    return ruleId;
  };

  const removeRecurringRule = (ruleId: string) => {
    setRecurringRules((prev) => prev.filter((rule) => rule.id !== ruleId));

    // This would need to be refactored to use mutations for proper React Query integration
    queryClient.invalidateQueries({ queryKey: schedulesQueryKey });
  };

  // ============================================================================
  // CSV IMPORT/EXPORT
  // ============================================================================

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseImportedSchedulesCsv(text, schedules);

        if (parsed.kind === 'invalid') {
          alert(parsed.message);
          setIsImporting(false);
          return;
        }

        if (parsed.importedSchedules.length > 0) {
          bulkImportMutation.mutate(parsed.importedSchedules);
        } else {
          alert('No valid schedules found in the CSV file');
          setIsImporting(false);
        }
      } catch (error) {
        alert(
          `Error importing CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        setIsImporting(false);
      }
    };

    reader.onerror = () => {
      alert('Error reading file');
      setIsImporting(false);
    };

    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    if (schedules.length === 0) {
      alert('No schedules to export');
      return;
    }

    const csvContent = buildSchedulesCsv(schedules);

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `schedules_${getCurrentDateISO()}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // State
    schedules: sortedSchedules,
    filteredSchedules: sortedSchedules,
    searchQuery,
    setSearchQuery,
    filterShiftType,
    setFilterShiftType,
    filterStatus,
    setFilterStatus,
    yearFilter,
    setYearFilter,
    isModalOpen,
    setIsModalOpen,
    editingSchedule,
    activeTab,
    setActiveTab,
    isImporting,

    // Form state
    formEmployeeName,
    setFormEmployeeName,
    formEmployeeId,
    setFormEmployeeId,
    formDate,
    setFormDate,
    formShiftType,
    setFormShiftType,
    formStartTime,
    setFormStartTime,
    formEndTime,
    setFormEndTime,
    formPosition,
    setFormPosition,
    formDepartment,
    setFormDepartment,
    formNotes,
    setFormNotes,

    // Computed values
    shiftTypes,
    yearOptions,
    totalSchedules,
    scheduledCount,
    completedCount,
    cancelledCount,
    weeklyBreakdown,

    // Utility functions
    formatDate,
    formatTime,
    getStatusColor,
    getShiftTypeColor,
    calculateDuration,
    getEmployeeLeaveForDate,

    // Event handlers
    handleAddSchedule,
    handleEditSchedule,
    handleDeleteSchedule,
    handleSaveSchedule,
    handleMarkCompleted,
    handleMarkCancelled,
    handleImportCSV,
    handleExportCSV,

    // Bulk scheduling
    recurringRules,
    upsertRecurringRule,
    removeRecurringRule,

    // Shared data
    employees,
    isLoadingEmployees,
    shiftConfig: SHIFT_CONFIG,
    dayLabels: DAY_LABELS,
  };
}
