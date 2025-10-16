import { useState, useMemo } from 'react';
import type { Schedule, ScheduleStatus, ShiftType } from '../types';

const generateId = () =>
  `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const shiftTypes: ShiftType[] = useMemo(
    () => ['morning', 'afternoon', 'night', 'full-day'],
    []
  );

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

    const scheduleData: Schedule = {
      id: editingSchedule?.id || generateId(),
      employeeId: formEmployeeId,
      employeeName: formEmployeeName,
      date: formDate,
      shiftType: formShiftType as ShiftType,
      startTime: formStartTime,
      endTime: formEndTime,
      position: formPosition,
      department: formDepartment,
      status: editingSchedule?.status || 'scheduled',
      notes: formNotes || undefined,
    };

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
  };
}
