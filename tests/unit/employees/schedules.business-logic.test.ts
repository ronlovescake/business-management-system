/**
 * Schedules Business Logic Tests
 *
 * Tests derived from docs/business-logic/clothing/employees-schedules.md
 * Covers: filterSchedules, sortSchedules, calculateScheduleStats, calculateWeeklyBreakdown.
 */

import { describe, it, expect } from 'vitest';
import {
  filterSchedules,
  sortSchedules,
  calculateScheduleStats,
  calculateWeeklyBreakdown,
} from '@/app/clothing/employees/schedules/hooks/scheduleListUtils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MinSchedule = {
  employeeName: string;
  employeeId: string;
  position: string;
  department: string;
  shiftType: string;
  status: string;
  date: string;
  startTime: string;
};

const makeSchedule = (overrides: Partial<MinSchedule> = {}): MinSchedule => ({
  employeeName: 'Alice Santos',
  employeeId: 'EMP-001',
  position: 'Packer',
  department: 'Operations',
  shiftType: 'Morning',
  status: 'scheduled',
  date: '2025-06-10',
  startTime: '08:00',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Section A — filterSchedules
// ---------------------------------------------------------------------------

describe('Schedules — filterSchedules', () => {
  const schedules = [
    makeSchedule({
      employeeName: 'Alice Santos',
      shiftType: 'Morning',
      status: 'scheduled',
      date: '2025-06-10',
    }),
    makeSchedule({
      employeeName: 'Bob Cruz',
      shiftType: 'Afternoon',
      status: 'completed',
      date: '2025-06-11',
    }),
    makeSchedule({
      employeeName: 'Carol Reyes',
      shiftType: 'Morning',
      status: 'cancelled',
      date: '2025-07-15',
      employeeId: 'EMP-003',
    }),
  ];

  it('returns all when no filters applied', () => {
    const result = filterSchedules(schedules, {
      searchQuery: '',
      filterShiftType: null,
      filterStatus: null,
    });
    expect(result).toHaveLength(3);
  });

  it('filters by employeeName (case-insensitive)', () => {
    const result = filterSchedules(schedules, {
      searchQuery: 'alice',
      filterShiftType: null,
      filterStatus: null,
    });
    expect(result).toHaveLength(1);
    expect(result[0].employeeName).toBe('Alice Santos');
  });

  it('filters by employeeId', () => {
    const result = filterSchedules(schedules, {
      searchQuery: 'EMP-003',
      filterShiftType: null,
      filterStatus: null,
    });
    expect(result).toHaveLength(1);
    expect(result[0].employeeName).toBe('Carol Reyes');
  });

  it('filters by shiftType', () => {
    const result = filterSchedules(schedules, {
      searchQuery: '',
      filterShiftType: 'Morning',
      filterStatus: null,
    });
    expect(result).toHaveLength(2);
  });

  it('filters by status', () => {
    const result = filterSchedules(schedules, {
      searchQuery: '',
      filterShiftType: null,
      filterStatus: 'completed',
    });
    expect(result).toHaveLength(1);
    expect(result[0].employeeName).toBe('Bob Cruz');
  });

  it('filters by year', () => {
    const result = filterSchedules(schedules, {
      searchQuery: '',
      filterShiftType: null,
      filterStatus: null,
      yearFilter: '2025',
    });
    expect(result).toHaveLength(3);
  });

  it('combines multiple filters (shiftType + status)', () => {
    const result = filterSchedules(schedules, {
      searchQuery: '',
      filterShiftType: 'Morning',
      filterStatus: 'scheduled',
    });
    expect(result).toHaveLength(1);
    expect(result[0].employeeName).toBe('Alice Santos');
  });

  it('returns empty when no matches', () => {
    const result = filterSchedules(schedules, {
      searchQuery: 'zzz',
      filterShiftType: null,
      filterStatus: null,
    });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Section B — sortSchedules
// ---------------------------------------------------------------------------

describe('Schedules — sortSchedules', () => {
  it('sorts newest date first', () => {
    const schedules = [
      makeSchedule({ date: '2025-01-01', startTime: '08:00' }),
      makeSchedule({ date: '2025-06-15', startTime: '08:00' }),
      makeSchedule({ date: '2025-03-10', startTime: '08:00' }),
    ];
    const sorted = sortSchedules(schedules);
    expect(sorted[0].date).toBe('2025-06-15');
    expect(sorted[2].date).toBe('2025-01-01');
  });

  it('breaks ties by startTime ascending', () => {
    const schedules = [
      makeSchedule({ date: '2025-06-10', startTime: '14:00' }),
      makeSchedule({ date: '2025-06-10', startTime: '08:00' }),
    ];
    const sorted = sortSchedules(schedules);
    expect(sorted[0].startTime).toBe('08:00');
    expect(sorted[1].startTime).toBe('14:00');
  });

  it('does not mutate the original array', () => {
    const schedules = [
      makeSchedule({ date: '2025-01-01' }),
      makeSchedule({ date: '2025-06-15' }),
    ];
    const originalOrder = [...schedules];
    sortSchedules(schedules);
    expect(schedules[0].date).toBe(originalOrder[0].date);
  });
});

// ---------------------------------------------------------------------------
// Section C — calculateScheduleStats
// ---------------------------------------------------------------------------

describe('Schedules — calculateScheduleStats', () => {
  it('counts total correctly', () => {
    const schedules = [
      makeSchedule({ status: 'scheduled' }),
      makeSchedule({ status: 'completed' }),
      makeSchedule({ status: 'cancelled' }),
    ];
    expect(calculateScheduleStats(schedules).total).toBe(3);
  });

  it('counts scheduled status', () => {
    const schedules = [
      makeSchedule({ status: 'scheduled' }),
      makeSchedule({ status: 'scheduled' }),
      makeSchedule({ status: 'completed' }),
    ];
    expect(calculateScheduleStats(schedules).scheduled).toBe(2);
  });

  it('counts completed status', () => {
    const schedules = [
      makeSchedule({ status: 'completed' }),
      makeSchedule({ status: 'scheduled' }),
    ];
    expect(calculateScheduleStats(schedules).completed).toBe(1);
  });

  it('counts cancelled status', () => {
    const schedules = [
      makeSchedule({ status: 'cancelled' }),
      makeSchedule({ status: 'cancelled' }),
      makeSchedule({ status: 'scheduled' }),
    ];
    expect(calculateScheduleStats(schedules).cancelled).toBe(2);
  });

  it('returns zeros for empty array', () => {
    const stats = calculateScheduleStats([]);
    expect(stats.total).toBe(0);
    expect(stats.scheduled).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Section D — calculateWeeklyBreakdown
// ---------------------------------------------------------------------------

describe('Schedules — calculateWeeklyBreakdown', () => {
  it('returns empty array for no schedules', () => {
    expect(calculateWeeklyBreakdown([])).toHaveLength(0);
  });

  it('groups same-week schedules together', () => {
    // 2025-06-09 (Mon) and 2025-06-10 (Tue) are in the same week (Sunday start = 2025-06-08)
    const schedules = [
      { date: '2025-06-09' },
      { date: '2025-06-10' },
      { date: '2025-06-16' }, // next week
    ];
    const breakdown = calculateWeeklyBreakdown(schedules);
    expect(breakdown).toHaveLength(2);
    const counts = breakdown.map((b) => b.count).sort((a, b) => b - a);
    expect(counts[0]).toBe(2); // two in one week
    expect(counts[1]).toBe(1); // one in next
  });

  it('each entry has week (string) and count (number)', () => {
    const result = calculateWeeklyBreakdown([{ date: '2025-06-09' }]);
    expect(result[0]).toHaveProperty('week');
    expect(result[0]).toHaveProperty('count');
    expect(typeof result[0].week).toBe('string');
    expect(typeof result[0].count).toBe('number');
  });
});
