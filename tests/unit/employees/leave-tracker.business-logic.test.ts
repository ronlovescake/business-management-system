/**
 * Leave Tracker Business Logic Tests
 *
 * Tests derived from docs/business-logic/clothing/employees-leave-tracker.md
 * Covers: buildEmployeeScheduleIndex.
 */

import { describe, it, expect } from 'vitest';
import { buildEmployeeScheduleIndex } from '@/app/clothing/employees/leave-tracker/hooks/leaveTrackerUtils';
import type { Schedule } from '@/app/clothing/employees/schedules/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeSchedule = (employeeId: string, date: string): Schedule => ({
  id: `${employeeId}-${date}`,
  employeeId,
  employeeName: 'Test Employee',
  date,
  shiftType: 'morning',
  startTime: '08:00',
  endTime: '17:00',
  position: 'Packer',
  department: 'Operations',
  status: 'scheduled',
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Leave Tracker — buildEmployeeScheduleIndex', () => {
  it('returns empty object for empty schedules array', () => {
    expect(buildEmployeeScheduleIndex([])).toEqual({});
  });

  it('indexes a single schedule', () => {
    const index = buildEmployeeScheduleIndex([
      makeSchedule('EMP-001', '2025-06-10'),
    ]);
    expect(index['EMP-001']).toBeInstanceOf(Set);
    expect(index['EMP-001'].has('2025-06-10')).toBe(true);
  });

  it('groups multiple dates for the same employee', () => {
    const schedules = [
      makeSchedule('EMP-001', '2025-06-10'),
      makeSchedule('EMP-001', '2025-06-11'),
      makeSchedule('EMP-001', '2025-06-12'),
    ];
    const index = buildEmployeeScheduleIndex(schedules);
    expect(index['EMP-001'].size).toBe(3);
    expect(index['EMP-001'].has('2025-06-11')).toBe(true);
  });

  it('keeps separate indexes for different employees', () => {
    const schedules = [
      makeSchedule('EMP-001', '2025-06-10'),
      makeSchedule('EMP-002', '2025-06-10'),
    ];
    const index = buildEmployeeScheduleIndex(schedules);
    expect(Object.keys(index)).toHaveLength(2);
    expect(index['EMP-001'].has('2025-06-10')).toBe(true);
    expect(index['EMP-002'].has('2025-06-10')).toBe(true);
  });

  it('deduplicates duplicate date entries for same employee', () => {
    const schedules = [
      makeSchedule('EMP-001', '2025-06-10'),
      makeSchedule('EMP-001', '2025-06-10'), // duplicate
    ];
    const index = buildEmployeeScheduleIndex(schedules);
    // Set should only have one entry for that date
    expect(index['EMP-001'].size).toBe(1);
  });

  it('trims whitespace from employeeId before indexing', () => {
    const schedule = { ...makeSchedule('  EMP-001  ', '2025-06-10') };
    const index = buildEmployeeScheduleIndex([schedule]);
    expect(index['EMP-001']).toBeDefined();
    expect(index['  EMP-001  ']).toBeUndefined();
  });
});
