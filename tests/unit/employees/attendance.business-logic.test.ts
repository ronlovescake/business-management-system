/**
 * Attendance Business Logic Tests
 *
 * Tests derived from docs/business-logic/clothing/employees-attendance.md
 * Covers: calculateTotalHours, getAutoRecordDateRange.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTotalHours,
  getAutoRecordDateRange,
  AUTO_RECORD_LOOKBACK_DAYS,
} from '@/app/clothing/employees/attendance/hooks/attendanceHookUtils';
import { DATE_STORAGE_FORMAT, dayjs, getCurrentDateISO } from '@/utils/date';

// ---------------------------------------------------------------------------
// Section A — calculateTotalHours
// ---------------------------------------------------------------------------

describe('Attendance — calculateTotalHours', () => {
  it('returns correct hours for standard shift (08:00 → 17:00)', () => {
    expect(calculateTotalHours('08:00', '17:00')).toBe(9);
  });

  it('returns correct hours with minutes (08:30 → 17:00)', () => {
    // (17*60) - (8*60 + 30) = 1020 - 510 = 510 / 60 = 8.5
    expect(calculateTotalHours('08:30', '17:00')).toBeCloseTo(8.5, 5);
  });

  it('returns null when timeIn is empty', () => {
    expect(calculateTotalHours('', '17:00')).toBeNull();
  });

  it('returns null when timeOut is empty', () => {
    expect(calculateTotalHours('08:00', '')).toBeNull();
  });

  it('returns null when both are empty', () => {
    expect(calculateTotalHours('', '')).toBeNull();
  });

  it('returns null when timeOut is before timeIn (diff <= 0)', () => {
    expect(calculateTotalHours('17:00', '08:00')).toBeNull();
  });

  it('returns null when timeOut equals timeIn', () => {
    expect(calculateTotalHours('09:00', '09:00')).toBeNull();
  });

  it('handles midnight end correctly if timeOut > timeIn', () => {
    // 00:00 is 0 minutes, 08:00 is 480 minutes — diff would be negative so returns null
    expect(calculateTotalHours('23:00', '00:00')).toBeNull();
  });

  it('returns 0.5 for 30-minute shift', () => {
    expect(calculateTotalHours('09:00', '09:30')).toBeCloseTo(0.5, 5);
  });
});

// ---------------------------------------------------------------------------
// Section B — getAutoRecordDateRange
// ---------------------------------------------------------------------------

describe('Attendance — getAutoRecordDateRange', () => {
  it(`returns exactly ${AUTO_RECORD_LOOKBACK_DAYS} dates`, () => {
    const dates = getAutoRecordDateRange();
    expect(dates).toHaveLength(AUTO_RECORD_LOOKBACK_DAYS);
  });

  it('first date is today', () => {
    const today = getCurrentDateISO();
    expect(getAutoRecordDateRange()[0]).toBe(today);
  });

  it('dates are in descending order (newest first)', () => {
    const dates = getAutoRecordDateRange();
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i] > dates[i + 1]).toBe(true);
    }
  });

  it('all dates are valid ISO strings (YYYY-MM-DD)', () => {
    const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
    for (const date of getAutoRecordDateRange()) {
      expect(date).toMatch(ISO_DATE_REGEX);
    }
  });

  it('last date is (lookback - 1) days ago', () => {
    const dates = getAutoRecordDateRange();
    const expected = dayjs(getCurrentDateISO())
      .subtract(AUTO_RECORD_LOOKBACK_DAYS - 1, 'day')
      .format(DATE_STORAGE_FORMAT);

    expect(dates[dates.length - 1]).toBe(expected);
  });
});
