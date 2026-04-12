/**
 * Schedules Module - Utility Functions Tests
 *
 * Comprehensive tests for schedules module utilities:
 * - Time parsing and conversion
 * - Time range calculations
 * - Schedule conflict detection
 * - Date formatting
 * - Duration calculations
 * - Status/shift type colors
 * - Weekly breakdown calculations
 * - Filtering and sorting logic
 *
 * Note: React Query hooks are tested through integration tests.
 * These tests focus on pure utility functions that can be unit tested.
 *
 * @group unit
 * @group schedules
 */

import { describe, it, expect } from 'vitest';
import type { ScheduleStatus, ShiftType } from '../../types';
import { MINUTES_IN_DAY } from '../scheduleHookUtils';
import {
  calculateDuration,
  getTimeRange,
  rangesOverlap,
  timeStringToMinutes,
} from '../scheduleTimeUtils';
import {
  calculateScheduleStats,
  calculateWeeklyBreakdown,
  filterSchedules,
  sortSchedules,
} from '../scheduleListUtils';
import { getEmployeeLeaveForDate as getEmployeeLeaveForDateFromList } from '../scheduleLeaveUtils';

// ==========================================================================
// TIME STRING PARSING
// ==========================================================================

describe('Time String to Minutes Conversion', () => {
  it('should convert valid time to minutes', () => {
    expect(timeStringToMinutes('08:00')).toBe(480); // 8 * 60
    expect(timeStringToMinutes('12:30')).toBe(750); // 12 * 60 + 30
    expect(timeStringToMinutes('17:45')).toBe(1065); // 17 * 60 + 45
    expect(timeStringToMinutes('00:00')).toBe(0);
    expect(timeStringToMinutes('23:59')).toBe(1439);
  });

  it('should handle single-digit hours', () => {
    expect(timeStringToMinutes('9:00')).toBe(540);
    expect(timeStringToMinutes('1:30')).toBe(90);
  });

  it('should return null for empty string', () => {
    expect(timeStringToMinutes('')).toBeNull();
  });

  it('should return null for whitespace-only string', () => {
    expect(timeStringToMinutes('   ')).toBeNull();
  });

  it('should trim whitespace', () => {
    expect(timeStringToMinutes('  08:30  ')).toBe(510);
  });

  it('should return null for invalid format', () => {
    expect(timeStringToMinutes('8:00 AM')).toBeNull();
    expect(timeStringToMinutes('8am')).toBeNull();
    expect(timeStringToMinutes('08-30')).toBeNull();
    expect(timeStringToMinutes('8')).toBeNull();
    expect(timeStringToMinutes('invalid')).toBeNull();
  });

  it('should return null for invalid hours', () => {
    expect(timeStringToMinutes('24:00')).toBeNull();
    expect(timeStringToMinutes('25:30')).toBeNull();
    expect(timeStringToMinutes('-1:00')).toBeNull();
  });

  it('should return null for invalid minutes', () => {
    expect(timeStringToMinutes('08:60')).toBeNull();
    expect(timeStringToMinutes('08:99')).toBeNull();
    expect(timeStringToMinutes('08:-5')).toBeNull();
  });

  it('should handle edge cases', () => {
    expect(timeStringToMinutes('00:01')).toBe(1);
    expect(timeStringToMinutes('23:00')).toBe(1380);
  });
});

// ==========================================================================
// TIME RANGE CALCULATIONS
// ==========================================================================

describe('Time Range Calculations', () => {
  it('should calculate range for same-day shift', () => {
    const range = getTimeRange('08:00', '17:00');
    expect(range).toEqual({ start: 480, end: 1020 });
  });

  it('should handle overnight shift (crosses midnight)', () => {
    const range = getTimeRange('23:00', '07:00');
    expect(range).toEqual({
      start: 1380, // 23:00
      end: 420 + MINUTES_IN_DAY, // 07:00 + 24h
    });
  });

  it('should handle midnight exactly', () => {
    const range = getTimeRange('22:00', '00:00');
    expect(range).toEqual({
      start: 1320,
      end: 0 + MINUTES_IN_DAY,
    });
  });

  it('should return null for invalid start time', () => {
    expect(getTimeRange('invalid', '17:00')).toBeNull();
  });

  it('should return null for invalid end time', () => {
    expect(getTimeRange('08:00', 'invalid')).toBeNull();
  });

  it('should handle equal start and end times', () => {
    const range = getTimeRange('08:00', '08:00');
    expect(range).toEqual({
      start: 480,
      end: 480 + MINUTES_IN_DAY,
    });
  });
});

// ==========================================================================
// TIME RANGE OVERLAP DETECTION
// ==========================================================================

describe('Time Range Overlap Detection', () => {
  it('should detect overlap when ranges intersect', () => {
    // Candidate: 9:00-12:00, Existing: 10:00-14:00
    expect(rangesOverlap(540, 720, 600, 840)).toBe(true);
  });

  it('should detect overlap when candidate contains existing', () => {
    // Candidate: 8:00-17:00, Existing: 10:00-14:00
    expect(rangesOverlap(480, 1020, 600, 840)).toBe(true);
  });

  it('should detect overlap when existing contains candidate', () => {
    // Candidate: 10:00-14:00, Existing: 8:00-17:00
    expect(rangesOverlap(600, 840, 480, 1020)).toBe(true);
  });

  it('should detect no overlap when ranges are separate', () => {
    // Candidate: 8:00-12:00, Existing: 13:00-17:00
    expect(rangesOverlap(480, 720, 780, 1020)).toBe(false);
  });

  it('should detect no overlap when ranges touch but do not overlap', () => {
    // Candidate: 8:00-12:00, Existing: 12:00-17:00
    expect(rangesOverlap(480, 720, 720, 1020)).toBe(false);
  });

  it('should handle exact same times', () => {
    // Both: 9:00-17:00
    expect(rangesOverlap(540, 1020, 540, 1020)).toBe(true);
  });

  it('should detect overlap with 1-minute intersection', () => {
    // Candidate: 8:00-12:01, Existing: 12:00-17:00
    expect(rangesOverlap(480, 721, 720, 1020)).toBe(true);
  });
});

// ==========================================================================
// DURATION CALCULATIONS
// ==========================================================================

describe('Duration Calculations', () => {
  it('should calculate duration for same-day shift', () => {
    expect(calculateDuration('08:00', '17:00')).toBe(9); // 9 hours
    expect(calculateDuration('09:00', '12:00')).toBe(3); // 3 hours
  });

  it('should calculate duration for overnight shift', () => {
    expect(calculateDuration('23:00', '07:00')).toBe(8); // 8 hours
    expect(calculateDuration('22:00', '06:00')).toBe(8); // 8 hours
  });

  it('should handle 30-minute increments', () => {
    expect(calculateDuration('08:30', '12:30')).toBe(4);
    expect(calculateDuration('09:15', '10:45')).toBe(1.5);
  });

  it('should return 0 for empty start time', () => {
    expect(calculateDuration('', '17:00')).toBe(0);
  });

  it('should return 0 for empty end time', () => {
    expect(calculateDuration('08:00', '')).toBe(0);
  });

  it('should return 0 for invalid times', () => {
    expect(calculateDuration('invalid', '17:00')).toBe(0);
    expect(calculateDuration('08:00', 'invalid')).toBe(0);
  });

  it('should calculate full 24-hour shift', () => {
    expect(calculateDuration('00:00', '00:00')).toBe(24);
  });

  it('should deduct one hour when lunch is included', () => {
    expect(calculateDuration('08:00', '17:00', true)).toBe(8);
  });
});

// ==========================================================================
// DATE FORMATTING
// ==========================================================================

describe('Date Formatting', () => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    }).format(date);
  };

  it('should format date correctly', () => {
    expect(formatDate('2024-01-15')).toMatch(/January 15, 2024/);
    expect(formatDate('2024-12-25')).toMatch(/December 25, 2024/);
  });

  it('should handle different months', () => {
    expect(formatDate('2024-06-01')).toMatch(/June 01, 2024/);
    expect(formatDate('2024-09-30')).toMatch(/September 30, 2024/);
  });
});

// ==========================================================================
// TIME FORMATTING
// ==========================================================================

describe('Time Formatting', () => {
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

  it('should format morning times', () => {
    expect(formatTime('08:00')).toBe('8:00 AM');
    expect(formatTime('09:30')).toBe('9:30 AM');
    expect(formatTime('11:45')).toBe('11:45 AM');
  });

  it('should format afternoon/evening times', () => {
    expect(formatTime('13:00')).toBe('1:00 PM');
    expect(formatTime('15:30')).toBe('3:30 PM');
    expect(formatTime('20:15')).toBe('8:15 PM');
  });

  it('should handle noon', () => {
    expect(formatTime('12:00')).toBe('12:00 PM');
    expect(formatTime('12:30')).toBe('12:30 PM');
  });

  it('should handle midnight', () => {
    expect(formatTime('00:00')).toBe('12:00 AM');
    expect(formatTime('00:30')).toBe('12:30 AM');
  });

  it('should return empty string for empty input', () => {
    expect(formatTime('')).toBe('');
  });

  it('should handle edge cases', () => {
    expect(formatTime('01:00')).toBe('1:00 AM');
    expect(formatTime('23:59')).toBe('11:59 PM');
  });
});

// ==========================================================================
// STATUS COLORS
// ==========================================================================

describe('Status Colors', () => {
  type ScheduleStatus = 'scheduled' | 'completed' | 'cancelled';

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

  it('should return blue for scheduled', () => {
    expect(getStatusColor('scheduled')).toBe('blue');
  });

  it('should return green for completed', () => {
    expect(getStatusColor('completed')).toBe('green');
  });

  it('should return red for cancelled', () => {
    expect(getStatusColor('cancelled')).toBe('red');
  });
});

// ==========================================================================
// SHIFT TYPE COLORS
// ==========================================================================

describe('Shift Type Colors', () => {
  type ShiftType = 'morning' | 'afternoon' | 'night' | 'full-day';

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

  it('should return orange for morning', () => {
    expect(getShiftTypeColor('morning')).toBe('orange');
  });

  it('should return yellow for afternoon', () => {
    expect(getShiftTypeColor('afternoon')).toBe('yellow');
  });

  it('should return indigo for night', () => {
    expect(getShiftTypeColor('night')).toBe('indigo');
  });

  it('should return cyan for full-day', () => {
    expect(getShiftTypeColor('full-day')).toBe('cyan');
  });
});

// ==========================================================================
// DATE UTILITIES
// ==========================================================================

describe('Date Utilities', () => {
  const toDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  it('should format date to YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2024, 0, 15))).toBe('2024-01-15');
    expect(toDateKey(new Date(2024, 11, 25))).toBe('2024-12-25');
  });

  it('should pad single-digit months and days', () => {
    expect(toDateKey(new Date(2024, 5, 1))).toBe('2024-06-01');
    expect(toDateKey(new Date(2024, 0, 5))).toBe('2024-01-05');
  });
});

// ==========================================================================
// WEEKLY BREAKDOWN CALCULATIONS
// ==========================================================================

describe('Weekly Breakdown Calculations', () => {
  it('should calculate weekly breakdown for empty array', () => {
    const breakdown = calculateWeeklyBreakdown([]);
    expect(breakdown).toEqual([]);
  });

  it('should group schedules by week', () => {
    const schedules = [
      { date: '2024-01-15' }, // Monday
      { date: '2024-01-16' }, // Tuesday (same week)
      { date: '2024-01-22' }, // Next Monday (different week)
    ];

    const breakdown = calculateWeeklyBreakdown(schedules);
    expect(breakdown).toHaveLength(2);
    expect(breakdown[0].count).toBe(2); // First week has 2
    expect(breakdown[1].count).toBe(1); // Second week has 1
  });

  it('should count all schedules in same week', () => {
    const schedules = [
      { date: '2024-01-14' }, // Sunday
      { date: '2024-01-15' }, // Monday
      { date: '2024-01-16' }, // Tuesday
      { date: '2024-01-17' }, // Wednesday
      { date: '2024-01-18' }, // Thursday
      { date: '2024-01-19' }, // Friday
      { date: '2024-01-20' }, // Saturday
    ];

    const breakdown = calculateWeeklyBreakdown(schedules);
    expect(breakdown).toHaveLength(1);
    expect(breakdown[0].count).toBe(7);
  });
});

// ==========================================================================
// SCHEDULE FILTERING
// ==========================================================================

describe('Schedule Filtering', () => {
  interface Schedule {
    employeeName: string;
    employeeId: string;
    position: string;
    department: string;
    shiftType: ShiftType;
    status: ScheduleStatus;
    date: string;
  }

  const mockSchedules: Schedule[] = [
    {
      employeeName: 'John Doe',
      employeeId: 'EMP-001',
      position: 'Engineer',
      department: 'Engineering',
      shiftType: 'morning',
      status: 'scheduled',
      date: '2024-01-15',
    },
    {
      employeeName: 'Jane Smith',
      employeeId: 'EMP-002',
      position: 'Manager',
      department: 'Management',
      shiftType: 'afternoon',
      status: 'completed',
      date: '2024-01-16',
    },
    {
      employeeName: 'Bob Johnson',
      employeeId: 'EMP-003',
      position: 'Engineer',
      department: 'Engineering',
      shiftType: 'night',
      status: 'cancelled',
      date: '2024-01-17',
    },
  ];

  it('should return all schedules with no filters', () => {
    const result = filterSchedules(mockSchedules, {
      searchQuery: '',
      filterShiftType: null,
      filterStatus: null,
    });
    expect(result).toHaveLength(3);
  });

  it('should filter by employee name', () => {
    const result = filterSchedules(mockSchedules, {
      searchQuery: 'John',
      filterShiftType: null,
      filterStatus: null,
    });
    expect(result).toHaveLength(2); // John Doe and Bob Johnson
  });

  it('should filter by employee ID', () => {
    const result = filterSchedules(mockSchedules, {
      searchQuery: 'EMP-001',
      filterShiftType: null,
      filterStatus: null,
    });
    expect(result).toHaveLength(1);
    expect(result[0].employeeName).toBe('John Doe');
  });

  it('should filter by position', () => {
    const result = filterSchedules(mockSchedules, {
      searchQuery: 'Engineer',
      filterShiftType: null,
      filterStatus: null,
    });
    expect(result).toHaveLength(2);
  });

  it('should filter by department', () => {
    const result = filterSchedules(mockSchedules, {
      searchQuery: 'Engineering',
      filterShiftType: null,
      filterStatus: null,
    });
    expect(result).toHaveLength(2);
  });

  it('should filter by shift type', () => {
    const result = filterSchedules(mockSchedules, {
      searchQuery: '',
      filterShiftType: 'morning',
      filterStatus: null,
    });
    expect(result).toHaveLength(1);
    expect(result[0].shiftType).toBe('morning');
  });

  it('should filter by status', () => {
    const result = filterSchedules(mockSchedules, {
      searchQuery: '',
      filterShiftType: null,
      filterStatus: 'completed',
    });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('completed');
  });

  it('should combine all filters', () => {
    const result = filterSchedules(mockSchedules, {
      searchQuery: 'Engineer',
      filterShiftType: 'morning',
      filterStatus: 'scheduled',
    });
    expect(result).toHaveLength(1);
    expect(result[0].employeeName).toBe('John Doe');
  });

  it('should be case-insensitive for search', () => {
    const result = filterSchedules(mockSchedules, {
      searchQuery: 'JOHN',
      filterShiftType: null,
      filterStatus: null,
    });
    expect(result).toHaveLength(2);
  });

  it('should trim search query', () => {
    const result = filterSchedules(mockSchedules, {
      searchQuery: '  John  ',
      filterShiftType: null,
      filterStatus: null,
    });
    expect(result).toHaveLength(2);
  });
});

// ==========================================================================
// SCHEDULE SORTING
// ==========================================================================

describe('Schedule Sorting', () => {
  interface Schedule {
    date: string;
    startTime: string;
  }

  it('should sort by date (newest first)', () => {
    const schedules: Schedule[] = [
      { date: '2024-01-15', startTime: '08:00' },
      { date: '2024-01-20', startTime: '09:00' },
      { date: '2024-01-10', startTime: '10:00' },
    ];

    const sorted = sortSchedules(schedules);
    expect(sorted[0].date).toBe('2024-01-20');
    expect(sorted[1].date).toBe('2024-01-15');
    expect(sorted[2].date).toBe('2024-01-10');
  });

  it('should sort by start time when dates are equal', () => {
    const schedules: Schedule[] = [
      { date: '2024-01-15', startTime: '12:00' },
      { date: '2024-01-15', startTime: '08:00' },
      { date: '2024-01-15', startTime: '15:00' },
    ];

    const sorted = sortSchedules(schedules);
    expect(sorted[0].startTime).toBe('08:00');
    expect(sorted[1].startTime).toBe('12:00');
    expect(sorted[2].startTime).toBe('15:00');
  });

  it('should handle empty array', () => {
    const sorted = sortSchedules([]);
    expect(sorted).toEqual([]);
  });

  it('should not mutate original array', () => {
    const schedules: Schedule[] = [
      { date: '2024-01-15', startTime: '08:00' },
      { date: '2024-01-20', startTime: '09:00' },
    ];

    const original = [...schedules];
    sortSchedules(schedules);
    expect(schedules).toEqual(original);
  });
});

// ==========================================================================
// STATISTICS CALCULATIONS
// ==========================================================================

describe('Statistics Calculations', () => {
  interface Schedule {
    status: ScheduleStatus;
  }

  it('should calculate stats for empty array', () => {
    const stats = calculateScheduleStats([]);
    expect(stats).toEqual({
      total: 0,
      scheduled: 0,
      completed: 0,
      cancelled: 0,
    });
  });

  it('should count schedules by status', () => {
    const schedules: Schedule[] = [
      { status: 'scheduled' },
      { status: 'scheduled' },
      { status: 'completed' },
      { status: 'cancelled' },
    ];

    const stats = calculateScheduleStats(schedules);
    expect(stats).toEqual({
      total: 4,
      scheduled: 2,
      completed: 1,
      cancelled: 1,
    });
  });

  it('should handle all same status', () => {
    const schedules: Schedule[] = [
      { status: 'completed' },
      { status: 'completed' },
      { status: 'completed' },
    ];

    const stats = calculateScheduleStats(schedules);
    expect(stats).toEqual({
      total: 3,
      scheduled: 0,
      completed: 3,
      cancelled: 0,
    });
  });
});

// ==========================================================================
// LEAVE MATCHING
// ==========================================================================

describe('Schedule Leave Matching', () => {
  const leaveRequests = [
    {
      employeeId: ' emp-001 ',
      employeeName: 'John Doe',
      leaveType: 'vacation',
      startDate: '2024-01-15',
      endDate: '2024-01-17',
      status: 'approved',
    },
    {
      employeeId: 'EMP-002',
      employeeName: 'Jane Smith',
      leaveType: 'sick',
      startDate: '2024-01-16',
      endDate: '2024-01-16',
      status: 'pending',
    },
  ];

  it('should match approved leave within the date range', () => {
    expect(
      getEmployeeLeaveForDateFromList(leaveRequests, 'EMP-001', '2024-01-16')
    ).toEqual({
      leaveType: 'vacation',
      status: 'approved',
      employeeName: 'John Doe',
    });
  });

  it('should normalize employee IDs before matching', () => {
    expect(
      getEmployeeLeaveForDateFromList(leaveRequests, ' emp-001 ', '2024-01-15')
    ).not.toBeNull();
  });

  it('should ignore non-approved leave requests', () => {
    expect(
      getEmployeeLeaveForDateFromList(leaveRequests, 'EMP-002', '2024-01-16')
    ).toBeNull();
  });

  it('should return null when no leave covers the date', () => {
    expect(
      getEmployeeLeaveForDateFromList(leaveRequests, 'EMP-001', '2024-01-20')
    ).toBeNull();
  });
});
