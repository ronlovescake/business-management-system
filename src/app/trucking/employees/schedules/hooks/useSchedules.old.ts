import { useState, useMemo, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import { getCurrentDateISO, toISODate } from '@/utils/date';
import type {
  Schedule,
  ScheduleStatus,
  ShiftType,
  RecurringRule,
  EmployeeSummary,
} from '../types';

const generateId = () =>
  `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const SHIFT_CONFIG: Record<
  ShiftType,
  { start: string; end: string; label: string }
> = {
  morning: {
    start: '08:00',
    end: '17:00',
    label: 'Morning (8:00 AM - 5:00 PM)',
  },
  afternoon: {
    start: '15:00',
    end: '00:00',
    label: 'Afternoon (3:00 PM - 12:00 AM)',
  },
  night: { start: '00:00', end: '09:00', label: 'Night (12:00 AM - 9:00 AM)' },
  'full-day': {
    start: '04:00',
    end: '17:00',
    label: 'Full Day (4:00 AM - 5:00 PM)',
  },
};

const MINUTES_IN_DAY = 24 * 60;

type ScheduleOverlapCandidate = {
  id?: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: ScheduleStatus;
};

const DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const parseDateInput = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Custom Hook: useSchedules
 *
 * Manages all business logic for the Schedules page:
 * - State management (schedules, filters, modals, forms)
 * - Computed values (filtered schedules, stats, weekly breakdown)
 * - Event handlers (CRUD operations, CSV import/export)
 * - Utility functions (formatters, validators)
 */
export function useSchedules() {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<
    Array<{
      id: string;
      employeeId: string;
      employeeName: string;
      leaveType: string;
      startDate: string;
      endDate: string;
      status: string;
    }>
  >([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterShiftType, setFilterShiftType] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [isImporting, setIsImporting] = useState(false);

  // Form state
  const [formEmployeeName, setFormEmployeeName] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formShiftType, setFormShiftType] = useState<ShiftType | ''>('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formPosition, setFormPosition] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Fetch employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setIsLoadingEmployees(true);
        const data = await api.get<
          Array<{
            id: number | string;
            employeeId: string;
            name: string;
            position: string;
            department: string;
            employeeType?: string;
          }>
        >('/api/trucking/employees?status=active');

        const transformed: EmployeeSummary[] = (data || []).map((emp) => ({
          id: String(emp.id),
          employeeId: emp.employeeId,
          name: emp.name,
          position: emp.position,
          department: emp.department,
          employeeType: emp.employeeType,
        }));

        setEmployees(transformed);
      } catch (error) {
        logger.error('Error fetching employees:', error);
        setEmployees([]);
      } finally {
        setIsLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, []);

  // Fetch schedules on mount
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const data = await api.get<Schedule[]>('/api/trucking/schedules');
        setSchedules(data || []);
      } catch (error) {
        logger.error('Error fetching schedules:', error);
        setSchedules([]);
      }
    };

    fetchSchedules();
  }, []);

  // Fetch leave requests on mount
  useEffect(() => {
    const fetchLeaveRequests = async () => {
      try {
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
        >('/api/trucking/leave-requests');
        setLeaveRequests(data || []);
      } catch (error) {
        logger.error('Error fetching leave requests:', error);
        setLeaveRequests([]);
      }
    };

    fetchLeaveRequests();
  }, []);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const shiftTypes: ShiftType[] = useMemo(
    () => ['morning', 'afternoon', 'night', 'full-day'],
    []
  );

  const stayInEmployees = useMemo(() => {
    return new Set(
      employees
        .filter((emp) => emp.employeeType === 'stay-in')
        .map((emp) => emp.employeeId)
    );
  }, [employees]);

  const filteredSchedules = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return schedules.filter((schedule) => {
      // Search filter
      const matchesSearch =
        !normalizedQuery ||
        schedule.employeeName.toLowerCase().includes(normalizedQuery) ||
        schedule.employeeId.toLowerCase().includes(normalizedQuery) ||
        schedule.position.toLowerCase().includes(normalizedQuery) ||
        schedule.department.toLowerCase().includes(normalizedQuery);

      // Shift type filter
      const matchesShiftType =
        !filterShiftType || schedule.shiftType === filterShiftType;

      // Status filter
      const matchesStatus = !filterStatus || schedule.status === filterStatus;

      return matchesSearch && matchesShiftType && matchesStatus;
    });
  }, [schedules, searchQuery, filterShiftType, filterStatus]);

  // Sort schedules by date (newest first)
  const sortedSchedules = useMemo(() => {
    return [...filteredSchedules].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();

      // If dates are equal, sort by start time
      if (dateA === dateB) {
        return a.startTime.localeCompare(b.startTime);
      }

      return dateB - dateA;
    });
  }, [filteredSchedules]);

  // Stats
  const totalSchedules = schedules.length;
  const scheduledCount = schedules.filter(
    (s) => s.status === 'scheduled'
  ).length;
  const completedCount = schedules.filter(
    (s) => s.status === 'completed'
  ).length;
  const cancelledCount = schedules.filter(
    (s) => s.status === 'cancelled'
  ).length;

  // Weekly breakdown for analytics
  const weeklyBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};

    schedules.forEach((schedule) => {
      const date = new Date(schedule.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      const weekKey = toISODate(weekStart) || '';

      breakdown[weekKey] = (breakdown[weekKey] || 0) + 1;
    });

    return Object.entries(breakdown).map(([week, count]) => ({
      week,
      count,
    }));
  }, [schedules]);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const timeStringToMinutes = (value: string): number | null => {
    const trimmed = value?.trim();
    if (!trimmed) {
      return null;
    }

    const match = /^([0-9]{1,2}):([0-9]{2})$/.exec(trimmed);
    if (!match) {
      return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    return hours * 60 + minutes;
  };

  const getTimeRange = (startTime: string, endTime: string) => {
    const start = timeStringToMinutes(startTime);
    const end = timeStringToMinutes(endTime);

    if (start === null || end === null) {
      return null;
    }

    const adjustedEnd = end <= start ? end + MINUTES_IN_DAY : end;

    return { start, end: adjustedEnd };
  };

  const rangesOverlap = (
    candidateStart: number,
    candidateEnd: number,
    existingStart: number,
    existingEnd: number
  ) => candidateStart < existingEnd && existingStart < candidateEnd;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const formatTime = (time: string) => {
    if (!time) {
      return '';
    }

    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

    return `${displayHour}:${minutes} ${ampm}`;
  };

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

  const calculateDuration = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) {
      return 0;
    }

    const range = getTimeRange(startTime, endTime);
    if (!range) {
      return 0;
    }

    return Math.max(0, (range.end - range.start) / 60);
  };

  const hasScheduleOverlap = (
    employeeId: string,
    date: string,
    startTime: string,
    endTime: string,
    ignoreScheduleId?: string,
    additional: ScheduleOverlapCandidate[] = []
  ): boolean => {
    if (!employeeId || !date) {
      return false;
    }

    const candidateRange = getTimeRange(startTime, endTime);
    if (!candidateRange) {
      return false;
    }

    const overlapPool: ScheduleOverlapCandidate[] = [
      ...schedules,
      ...additional,
    ].map((schedule) => ({
      id: schedule.id,
      employeeId: schedule.employeeId,
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      status: schedule.status,
    }));

    return overlapPool.some((schedule) => {
      if (schedule.employeeId !== employeeId || schedule.date !== date) {
        return false;
      }

      if (ignoreScheduleId && schedule.id === ignoreScheduleId) {
        return false;
      }

      if ((schedule.status ?? 'scheduled') === 'cancelled') {
        return false;
      }

      const existingRange = getTimeRange(schedule.startTime, schedule.endTime);
      if (!existingRange) {
        return false;
      }

      return rangesOverlap(
        candidateRange.start,
        candidateRange.end,
        existingRange.start,
        existingRange.end
      );
    });
  };

  const getEmployeeLeaveForDate = (
    employeeId: string,
    date: string
  ): { leaveType: string; status: string; employeeName: string } | null => {
    const leave = leaveRequests.find((request) => {
      // Normalize both IDs for comparison (trim and lowercase)
      const requestId = String(request.employeeId || '')
        .trim()
        .toLowerCase();
      const scheduleId = String(employeeId || '')
        .trim()
        .toLowerCase();

      if (requestId !== scheduleId) {
        return false;
      }

      // Only show approved leaves
      if (request.status !== 'approved') {
        return false;
      }

      // Check if date falls within leave period
      return date >= request.startDate && date <= request.endDate;
    });

    return leave
      ? {
          leaveType: leave.leaveType,
          status: leave.status,
          employeeName: leave.employeeName,
        }
      : null;
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleAddSchedule = () => {
    setEditingSchedule(null);
    setFormEmployeeName('');
    setFormEmployeeId('');
    setFormDate('');
    setFormShiftType('');
    setFormStartTime('');
    setFormEndTime('');
    setFormPosition('');
    setFormDepartment('');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormEmployeeName(schedule.employeeName);
    setFormEmployeeId(schedule.employeeId);
    setFormDate(schedule.date);
    setFormShiftType(schedule.shiftType);
    setFormStartTime(schedule.startTime);
    setFormEndTime(schedule.endTime);
    setFormPosition(schedule.position);
    setFormDepartment(schedule.department);
    setFormNotes(schedule.notes || '');
    setIsModalOpen(true);
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await api.delete(`/api/trucking/schedules?id=${id}`);

      // Update local state
      setSchedules((prev) => prev.filter((schedule) => schedule.id !== id));
    } catch (error) {
      logger.error('Error deleting schedule:', error);
      alert('Failed to delete schedule. Please try again.');
    }
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

    try {
      if (editingSchedule) {
        // Update existing schedule
        const result = await api.patch<{ schedule: Schedule }>(
          '/api/trucking/schedules',
          { ...scheduleData, id: editingSchedule.id }
        );

        // Update local state
        setSchedules((prev) =>
          prev.map((schedule) =>
            schedule.id === editingSchedule.id ? result.schedule : schedule
          )
        );
      } else {
        // Create new schedule
        const result = await api.post<{ schedules: Schedule[] }>(
          '/api/trucking/schedules',
          scheduleData
        );

        // Add to local state
        setSchedules((prev) => [...prev, result.schedules[0]]);
      }

      setIsModalOpen(false);
    } catch (error) {
      logger.error('Error saving schedule:', error);
      alert('Failed to save schedule. Please try again.');
    }
  };

  const handleMarkCompleted = async (id: string) => {
    try {
      await api.patch('/api/trucking/schedules', { id, status: 'completed' });

      // Update local state
      setSchedules((prev) =>
        prev.map((schedule) =>
          schedule.id === id
            ? { ...schedule, status: 'completed' as const }
            : schedule
        )
      );
    } catch (error) {
      logger.error('Error updating schedule status:', error);
      alert('Failed to update schedule status. Please try again.');
    }
  };

  const handleMarkCancelled = async (id: string) => {
    try {
      await api.patch('/api/trucking/schedules', { id, status: 'cancelled' });

      // Update local state
      setSchedules((prev) =>
        prev.map((schedule) =>
          schedule.id === id
            ? { ...schedule, status: 'cancelled' as const }
            : schedule
        )
      );
    } catch (error) {
      logger.error('Error updating schedule status:', error);
      alert('Failed to update schedule status. Please try again.');
    }
  };

  // ==========================================================================
  // BULK SCHEDULING HELPERS
  // ==========================================================================

  const generateSchedulesForRule = (
    rule: RecurringRule,
    overrides: Record<string, boolean>
  ): Schedule[] => {
    const start = parseDateInput(rule.startDate);
    const end = rule.endDate
      ? parseDateInput(rule.endDate)
      : new Date(start.getFullYear(), start.getMonth() + 3, start.getDate());

    const schedulesForRule: Schedule[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      const dayOfWeek = cursor.getDay();
      const includeSunday = rule.daysOfWeek.includes(0);
      if (dayOfWeek === 0 && !includeSunday) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }

      if (rule.daysOfWeek.includes(dayOfWeek)) {
        const dateStr = toDateKey(cursor);
        if (!overrides[dateStr]) {
          const stayIn = rule.isStayIn || stayInEmployees.has(rule.employeeId);
          const shiftType = stayIn ? ('full-day' as ShiftType) : rule.shiftType;
          const defaults = SHIFT_CONFIG[shiftType];

          schedulesForRule.push({
            id: generateId(),
            employeeId: rule.employeeId,
            employeeName: rule.employeeName,
            date: dateStr,
            shiftType,
            startTime: defaults.start,
            endTime: defaults.end,
            position: rule.position,
            department: rule.department,
            status: 'scheduled',
            notes: rule.notes,
            source: 'recurrence',
            recurrenceId: rule.id,
          });
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return schedulesForRule;
  };

  const upsertRecurringRule = (
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

    setSchedules((prev) => {
      const overrides = prev
        .filter(
          (schedule) => schedule.recurrenceId === ruleId && schedule.isOverride
        )
        .reduce<Record<string, boolean>>((acc, schedule) => {
          acc[schedule.date] = true;
          return acc;
        }, {});

      const filtered = prev.filter(
        (schedule) => schedule.recurrenceId !== ruleId || schedule.isOverride
      );

      const generated = generateSchedulesForRule(normalizedRule, overrides);

      const deduped = generated.filter((generatedSchedule) => {
        return !filtered.some(
          (existing) =>
            existing.employeeId === generatedSchedule.employeeId &&
            existing.date === generatedSchedule.date &&
            !existing.isOverride
        );
      });

      return [...filtered, ...deduped];
    });

    return ruleId;
  };

  const removeRecurringRule = (ruleId: string) => {
    setRecurringRules((prev) => prev.filter((rule) => rule.id !== ruleId));

    setSchedules((prev) =>
      prev
        .map((schedule) => {
          if (schedule.recurrenceId !== ruleId) {
            return schedule;
          }

          if (schedule.isOverride) {
            return {
              ...schedule,
              source: 'manual' as const,
              recurrenceId: undefined,
            };
          }

          return null;
        })
        .filter((schedule): schedule is Schedule => schedule !== null)
    );
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
        const lines = text.split('\n').filter((line) => line.trim());

        if (lines.length < 2) {
          alert('CSV file is empty or invalid');
          setIsImporting(false);
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

        const requiredColumns = [
          'employeeid',
          'employeename',
          'date',
          'shifttype',
          'starttime',
          'endtime',
          'position',
          'department',
        ];
        const missingColumns = requiredColumns.filter(
          (col) => !headers.includes(col)
        );

        if (missingColumns.length > 0) {
          alert(
            `Missing required columns: ${missingColumns.join(', ')}\n\n` +
              'Required columns: employeeId, employeeName, date, shiftType, startTime, endTime, position, department\n' +
              'Optional columns: status, notes'
          );
          setIsImporting(false);
          return;
        }

        const importedSchedules: Schedule[] = [];
        let successCount = 0;
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          try {
            const values = parseCSVLine(lines[i]);
            const row: Record<string, string> = {};

            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });

            if (
              !row.employeeid &&
              !row.employeename &&
              !row.date &&
              !row.starttime &&
              !row.endtime
            ) {
              continue;
            }

            if (
              !row.employeeid ||
              !row.employeename ||
              !row.date ||
              !row.shifttype ||
              !row.starttime ||
              !row.endtime ||
              !row.position ||
              !row.department
            ) {
              errors.push(`Row ${i + 1}: Missing required field(s)`);
              continue;
            }

            const timeRange = getTimeRange(row.starttime, row.endtime);
            if (!timeRange) {
              errors.push(`Row ${i + 1}: Invalid start or end time`);
              continue;
            }

            if (
              hasScheduleOverlap(
                row.employeeid,
                row.date,
                row.starttime,
                row.endtime,
                undefined,
                importedSchedules
              )
            ) {
              errors.push(
                `Row ${i + 1}: Schedule overlaps with an existing schedule for employee ${row.employeeid}`
              );
              continue;
            }

            const schedule: Partial<Schedule> = {
              employeeId: row.employeeid,
              employeeName: row.employeename,
              date: row.date,
              shiftType: row.shifttype as ShiftType,
              startTime: row.starttime,
              endTime: row.endtime,
              position: row.position,
              department: row.department,
              status: (row.status as ScheduleStatus) || 'scheduled',
              notes: row.notes || undefined,
              source: 'manual',
              isOverride: false,
            };

            importedSchedules.push(schedule as Schedule);
            successCount++;
          } catch (error) {
            errors.push(
              `Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }

        if (importedSchedules.length > 0) {
          // Save imported schedules to database
          try {
            const result = await api.post<{ schedules: Schedule[] }>(
              '/api/trucking/schedules',
              importedSchedules
            );

            // Update local state with saved schedules
            setSchedules((prev) => [...prev, ...result.schedules]);

            alert(
              `Successfully imported ${successCount} schedule(s)` +
                (errors.length > 0 ? `\n\nErrors: ${errors.length}` : '')
            );
          } catch (error) {
            logger.error('Error saving imported schedules:', error);
            alert(
              'Failed to save imported schedules to database. Error: ' +
                (error instanceof Error ? error.message : String(error))
            );
          } finally {
            setIsImporting(false);
          }
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

    const headers = [
      'employeeId',
      'employeeName',
      'date',
      'shiftType',
      'startTime',
      'endTime',
      'position',
      'department',
      'status',
      'notes',
    ];

    const csvContent = [
      headers.join(','),
      ...schedules.map((schedule) => {
        const row = [
          schedule.employeeId,
          schedule.employeeName,
          schedule.date,
          schedule.shiftType,
          schedule.startTime,
          schedule.endTime,
          schedule.position,
          schedule.department,
          schedule.status,
          schedule.notes || '',
        ];

        return row
          .map((field) => {
            const stringField = String(field);
            if (stringField.includes(',') || stringField.includes('"')) {
              return `"${stringField.replace(/"/g, '""')}"`;
            }
            return stringField;
          })
          .join(',');
      }),
    ].join('\n');

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
