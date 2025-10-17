import { useState, useMemo, useEffect } from 'react';
import type {
  Schedule,
  ScheduleStatus,
  ShiftType,
  WeeklyTemplate,
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

const DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

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
  const [weeklyTemplates, setWeeklyTemplates] = useState<WeeklyTemplate[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);

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

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setIsLoadingEmployees(true);
        const response = await fetch('/api/employees?status=active');
        if (!response.ok) {
          throw new Error('Failed to fetch employees');
        }

        const data = await response.json();
        const transformed: EmployeeSummary[] = (data || []).map(
          (emp: {
            id: number | string;
            employeeId: string;
            name: string;
            position: string;
            department: string;
            employeeType?: string;
          }) => ({
            id: String(emp.id),
            employeeId: emp.employeeId,
            name: emp.name,
            position: emp.position,
            department: emp.department,
            employeeType: emp.employeeType,
          })
        );

        setEmployees(transformed);
      } catch (error) {
        console.error('Error fetching employees:', error);
        setEmployees([]);
      } finally {
        setIsLoadingEmployees(false);
      }
    };

    fetchEmployees();
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
      const weekKey = weekStart.toISOString().split('T')[0];

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

    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;

    const duration = endTotalMinutes - startTotalMinutes;
    return duration / 60; // Return hours
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

  const handleDeleteSchedule = (id: string) => {
    setSchedules((prev) => prev.filter((schedule) => schedule.id !== id));
  };

  const handleSaveSchedule = () => {
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

    const scheduleData: Schedule = {
      id: editingSchedule?.id || generateId(),
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
      isOverride: editingSchedule?.isOverride,
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

    if (editingSchedule) {
      setSchedules((prev) =>
        prev.map((schedule) =>
          schedule.id === editingSchedule.id ? scheduleData : schedule
        )
      );
    } else {
      setSchedules((prev) => [...prev, scheduleData]);
    }

    setIsModalOpen(false);
  };

  const handleMarkCompleted = (id: string) => {
    setSchedules((prev) =>
      prev.map((schedule) =>
        schedule.id === id
          ? { ...schedule, status: 'completed' as const }
          : schedule
      )
    );
  };

  const handleMarkCancelled = (id: string) => {
    setSchedules((prev) =>
      prev.map((schedule) =>
        schedule.id === id
          ? { ...schedule, status: 'cancelled' as const }
          : schedule
      )
    );
  };

  // ==========================================================================
  // BULK SCHEDULING HELPERS
  // ==========================================================================

  const upsertWeeklyTemplate = (
    template: Omit<WeeklyTemplate, 'id'> & { id?: string }
  ) => {
    if (template.id) {
      const templateId = template.id;
      setWeeklyTemplates((prev) =>
        prev.map((existing) =>
          existing.id === templateId
            ? {
                ...existing,
                ...template,
                id: templateId,
                assignments: [...template.assignments],
              }
            : existing
        )
      );
      return templateId;
    }

    const newTemplate: WeeklyTemplate = {
      ...template,
      id: generateId(),
      assignments: [...template.assignments],
    };
    setWeeklyTemplates((prev) => [...prev, newTemplate]);
    return newTemplate.id;
  };

  const deleteWeeklyTemplate = (templateId: string) => {
    setWeeklyTemplates((prev) =>
      prev.filter((template) => template.id !== templateId)
    );
  };

  const applyWeeklyTemplateToWeek = (
    templateId: string,
    targetDate: string
  ): { added: number; skipped: number } => {
    const template = weeklyTemplates.find((tpl) => tpl.id === templateId);
    if (!template) {
      return { added: 0, skipped: 0 };
    }

    const referenceDate = new Date(targetDate);
    referenceDate.setHours(0, 0, 0, 0);
    const weekStart = new Date(referenceDate);
    weekStart.setDate(referenceDate.getDate() - referenceDate.getDay());

    const existingKeys = new Set(
      schedules.map((schedule) => `${schedule.employeeId}-${schedule.date}`)
    );

    const newSchedules: Schedule[] = [];

    let skipped = 0;

    template.assignments.forEach((assignment) => {
      if (!template.allowSundayAssignments && assignment.dayOfWeek === 0) {
        return;
      }

      if (!assignment.employeeId || !assignment.employeeName) {
        return;
      }

      const assignmentDate = new Date(weekStart);
      assignmentDate.setDate(weekStart.getDate() + assignment.dayOfWeek);
      const dateString = assignmentDate.toISOString().split('T')[0];

      const stayIn =
        assignment.isStayIn || stayInEmployees.has(assignment.employeeId);
      const shiftType = stayIn
        ? ('full-day' as ShiftType)
        : assignment.shiftType;
      const defaults = SHIFT_CONFIG[shiftType];
      const startTime = assignment.startTime || defaults.start;
      const endTime = assignment.endTime || defaults.end;
      const key = `${assignment.employeeId}-${dateString}`;

      if (existingKeys.has(key)) {
        skipped += 1;
        return;
      }

      existingKeys.add(key);
      newSchedules.push({
        id: generateId(),
        employeeId: assignment.employeeId,
        employeeName: assignment.employeeName,
        date: dateString,
        shiftType,
        startTime,
        endTime,
        position: assignment.role,
        department: assignment.department,
        status: 'scheduled',
        notes: assignment.notes,
        source: 'template',
        templateId: template.id,
      });
    });

    if (newSchedules.length > 0) {
      setSchedules((prev) => [...prev, ...newSchedules]);
    }

    return {
      added: newSchedules.length,
      skipped,
    };
  };

  const generateSchedulesForRule = (
    rule: RecurringRule,
    overrides: Record<string, boolean>
  ): Schedule[] => {
    const start = new Date(rule.startDate);
    start.setHours(0, 0, 0, 0);
    const end = rule.endDate
      ? new Date(rule.endDate)
      : new Date(start.getFullYear(), start.getMonth() + 3, start.getDate());
    end.setHours(0, 0, 0, 0);

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
        const dateStr = cursor.toISOString().split('T')[0];
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

    reader.onload = (e) => {
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

            const schedule: Schedule = {
              id: generateId(),
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
            };

            importedSchedules.push(schedule);
            successCount++;
          } catch (error) {
            errors.push(
              `Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }

        if (importedSchedules.length > 0) {
          setSchedules((prev) => [...prev, ...importedSchedules]);
          alert(
            `Successfully imported ${successCount} schedule(s)` +
              (errors.length > 0 ? `\n\nErrors: ${errors.length}` : '')
          );
        } else {
          alert('No valid schedules found in the CSV file');
        }

        setIsImporting(false);
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
    link.setAttribute(
      'download',
      `schedules_${new Date().toISOString().split('T')[0]}.csv`
    );
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
    weeklyTemplates,
    recurringRules,
    upsertWeeklyTemplate,
    deleteWeeklyTemplate,
    applyWeeklyTemplateToWeek,
    upsertRecurringRule,
    removeRecurringRule,

    // Shared data
    employees,
    isLoadingEmployees,
    shiftConfig: SHIFT_CONFIG,
    dayLabels: DAY_LABELS,
  };
}
