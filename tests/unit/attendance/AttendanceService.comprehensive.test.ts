/**
 * Comprehensive Tests for Attendance Service & Calculations
 * Tests attendance logic, time calculations, status transitions, and validations
 */

import { describe, it, expect } from 'vitest';

// Time Formatting
const formatTime = (time: string) => {
  if (!time || time.trim() === '') {
    return '—';
  }
  const parts = time.split(':');
  if (parts.length < 2) {
    return '—';
  }
  
  const [hours, minutes] = parts.map(Number);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return '—';
  }
  
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

// Hours Calculation
const calculateTotalHours = (timeIn: string, timeOut: string) => {
  if (!timeIn || !timeOut) {
    return null;
  }
  
  const [inHours, inMinutes] = timeIn.split(':').map(Number);
  const [outHours, outMinutes] = timeOut.split(':').map(Number);
  
  if ([inHours, inMinutes, outHours, outMinutes].some((value) => Number.isNaN(value))) {
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

// Break Duration Calculation
const calculateBreakDuration = (start: string, end: string) => {
  if (!start || !end) {
    return 0;
  }
  
  const [startHours, startMinutes] = start.split(':').map(Number);
  const [endHours, endMinutes] = end.split(':').map(Number);
  
  if ([startHours, startMinutes, endHours, endMinutes].some((value) => Number.isNaN(value))) {
    return 0;
  }
  
  const startTotal = startHours * 60 + startMinutes;
  const endTotal = endHours * 60 + endMinutes;
  const diff = endTotal - startTotal;
  
  return diff > 0 ? diff : 0;
};

// Net Hours (excluding breaks)
const calculateNetHours = (
  timeIn: string,
  timeOut: string,
  break1Start: string,
  break1End: string,
  lunchStart: string,
  lunchEnd: string,
  break2Start: string,
  break2End: string
) => {
  const totalHours = calculateTotalHours(timeIn, timeOut);
  if (!totalHours) {
    return null;
  }
  
  const break1Duration = calculateBreakDuration(break1Start, break1End);
  const lunchDuration = calculateBreakDuration(lunchStart, lunchEnd);
  const break2Duration = calculateBreakDuration(break2Start, break2End);
  
  const totalBreakMinutes = break1Duration + lunchDuration + break2Duration;
  const netHours = totalHours - (totalBreakMinutes / 60);
  
  return netHours > 0 ? netHours : 0;
};

// Status Determination
const determineStatus = (timeIn: string, expectedTimeIn: string = '08:00') => {
  if (!timeIn) {
    return 'absent';
  }
  
  const [actualHours, actualMinutes] = timeIn.split(':').map(Number);
  const [expectedHours, expectedMinutes] = expectedTimeIn.split(':').map(Number);
  
  if ([actualHours, actualMinutes, expectedHours, expectedMinutes].some((value) => Number.isNaN(value))) {
    return 'present';
  }
  
  const actualTotal = actualHours * 60 + actualMinutes;
  const expectedTotal = expectedHours * 60 + expectedMinutes;
  
  // More than 15 minutes late
  if (actualTotal - expectedTotal > 15) {
    return 'late';
  }
  
  return 'present';
};

// Overtime Calculation
const calculateOvertime = (netHours: number, standardHours: number = 8) => {
  if (netHours <= standardHours) {
    return 0;
  }
  return netHours - standardHours;
};

// Undertime Calculation
const calculateUndertime = (netHours: number, standardHours: number = 8) => {
  if (netHours >= standardHours) {
    return 0;
  }
  return standardHours - netHours;
};

describe('Attendance Service', () => {
  describe('Time Formatting', () => {
    it('should format valid time correctly', () => {
      expect(formatTime('08:30')).toMatch(/8:30 AM/i);
      expect(formatTime('13:45')).toMatch(/1:45 PM/i);
      expect(formatTime('00:00')).toMatch(/12:00 AM/i);
      expect(formatTime('23:59')).toMatch(/11:59 PM/i);
    });

    it('should handle invalid time formats', () => {
      expect(formatTime('')).toBe('—');
      expect(formatTime('invalid')).toBe('—');
      expect(formatTime('25:00')).toBe('—');
      expect(formatTime('12:65')).toBe('—');
      expect(formatTime('12')).toBe('—');
    });
  });

  describe('Total Hours Calculation', () => {
    it('should calculate hours correctly', () => {
      expect(calculateTotalHours('08:00', '17:00')).toBe(9);
      expect(calculateTotalHours('09:30', '18:00')).toBe(8.5);
      expect(calculateTotalHours('00:00', '08:00')).toBe(8);
    });

    it('should handle missing times', () => {
      expect(calculateTotalHours('', '17:00')).toBeNull();
      expect(calculateTotalHours('08:00', '')).toBeNull();
      expect(calculateTotalHours('', '')).toBeNull();
    });

    it('should handle invalid time ranges', () => {
      expect(calculateTotalHours('17:00', '08:00')).toBeNull(); // Time out before time in
      expect(calculateTotalHours('08:00', '08:00')).toBeNull(); // Same time
    });

    it('should handle invalid time formats', () => {
      expect(calculateTotalHours('invalid', '17:00')).toBeNull();
      expect(calculateTotalHours('08:00', 'invalid')).toBeNull();
      expect(calculateTotalHours('25:00', '17:00')).toBeNull();
    });
  });

  describe('Break Duration Calculation', () => {
    it('should calculate break duration correctly', () => {
      expect(calculateBreakDuration('10:00', '10:15')).toBe(15); // 15 min break
      expect(calculateBreakDuration('12:00', '13:00')).toBe(60); // 1 hour lunch
      expect(calculateBreakDuration('15:00', '15:15')).toBe(15); // 15 min break
    });

    it('should handle missing break times', () => {
      expect(calculateBreakDuration('', '10:15')).toBe(0);
      expect(calculateBreakDuration('10:00', '')).toBe(0);
      expect(calculateBreakDuration('', '')).toBe(0);
    });

    it('should handle invalid break times', () => {
      expect(calculateBreakDuration('10:15', '10:00')).toBe(0); // End before start
      expect(calculateBreakDuration('invalid', '10:15')).toBe(0);
      expect(calculateBreakDuration('10:00', 'invalid')).toBe(0);
    });
  });

  describe('Net Hours Calculation (excluding breaks)', () => {
    it('should calculate net hours correctly', () => {
      // 9 hours total - 0.25 (break1) - 1 (lunch) - 0.25 (break2) = 7.5 hours
      const netHours = calculateNetHours(
        '08:00', '17:00',
        '10:00', '10:15',
        '12:00', '13:00',
        '15:00', '15:15'
      );
      expect(netHours).toBeCloseTo(7.5, 2);
    });

    it('should handle missing breaks', () => {
      // 8 hours total - no breaks = 8 hours
      const netHours = calculateNetHours(
        '09:00', '17:00',
        '', '',
        '', '',
        '', ''
      );
      expect(netHours).toBe(8);
    });

    it('should handle partial breaks', () => {
      // 8 hours total - 1 hour lunch = 7 hours
      const netHours = calculateNetHours(
        '09:00', '17:00',
        '', '',
        '12:00', '13:00',
        '', ''
      );
      expect(netHours).toBeCloseTo(7, 2);
    });

    it('should return null for invalid times', () => {
      const netHours = calculateNetHours(
        '', '17:00',
        '10:00', '10:15',
        '12:00', '13:00',
        '15:00', '15:15'
      );
      expect(netHours).toBeNull();
    });

    it('should not return negative hours', () => {
      // Edge case: breaks exceed total hours
      const netHours = calculateNetHours(
        '08:00', '09:00', // Only 1 hour
        '08:15', '08:30', // 15 min
        '08:30', '08:45', // 15 min
        '08:45', '09:00'  // 15 min
      );
      expect(netHours).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Status Determination', () => {
    it('should mark as present for on-time arrival', () => {
      expect(determineStatus('08:00', '08:00')).toBe('present');
      expect(determineStatus('07:50', '08:00')).toBe('present'); // Early
    });

    it('should mark as present for slight lateness (<=15 min)', () => {
      expect(determineStatus('08:10', '08:00')).toBe('present');
      expect(determineStatus('08:15', '08:00')).toBe('present');
    });

    it('should mark as late for >15 min lateness', () => {
      expect(determineStatus('08:16', '08:00')).toBe('late');
      expect(determineStatus('08:30', '08:00')).toBe('late');
      expect(determineStatus('09:00', '08:00')).toBe('late');
    });

    it('should mark as absent for missing time in', () => {
      expect(determineStatus('', '08:00')).toBe('absent');
    });

    it('should handle different expected start times', () => {
      expect(determineStatus('09:00', '09:00')).toBe('present');
      expect(determineStatus('09:20', '09:00')).toBe('late');
      expect(determineStatus('07:00', '07:00')).toBe('present');
    });
  });

  describe('Overtime Calculation', () => {
    it('should calculate overtime correctly', () => {
      expect(calculateOvertime(9, 8)).toBe(1);
      expect(calculateOvertime(10.5, 8)).toBe(2.5);
      expect(calculateOvertime(12, 8)).toBe(4);
    });

    it('should return 0 for no overtime', () => {
      expect(calculateOvertime(8, 8)).toBe(0);
      expect(calculateOvertime(7, 8)).toBe(0);
      expect(calculateOvertime(0, 8)).toBe(0);
    });

    it('should handle custom standard hours', () => {
      expect(calculateOvertime(10, 9)).toBe(1); // 9-hour standard shift
      expect(calculateOvertime(13, 12)).toBe(1); // 12-hour standard shift
    });
  });

  describe('Undertime Calculation', () => {
    it('should calculate undertime correctly', () => {
      expect(calculateUndertime(7, 8)).toBe(1);
      expect(calculateUndertime(5.5, 8)).toBe(2.5);
      expect(calculateUndertime(4, 8)).toBe(4);
    });

    it('should return 0 for no undertime', () => {
      expect(calculateUndertime(8, 8)).toBe(0);
      expect(calculateUndertime(9, 8)).toBe(0);
      expect(calculateUndertime(10, 8)).toBe(0);
    });

    it('should handle custom standard hours', () => {
      expect(calculateUndertime(8, 9)).toBe(1); // 9-hour standard shift
      expect(calculateUndertime(10, 12)).toBe(2); // 12-hour standard shift
    });
  });

  describe('Attendance Validation', () => {
    it('should validate time format', () => {
      const validTimes = ['08:00', '12:30', '17:45', '00:00', '23:59'];
      validTimes.forEach(time => {
        expect(formatTime(time)).not.toBe('—');
      });
    });

    it('should validate time ranges', () => {
      expect(calculateTotalHours('08:00', '17:00')).not.toBeNull();
      expect(calculateTotalHours('17:00', '08:00')).toBeNull(); // Invalid range
    });

    it('should validate break consistency', () => {
      const netHours = calculateNetHours(
        '08:00', '17:00',
        '10:00', '10:15',
        '12:00', '13:00',
        '15:00', '15:15'
      );
      expect(netHours).toBeGreaterThan(0);
      expect(netHours).toBeLessThanOrEqual(9); // Can't exceed total hours
    });
  });

  describe('Attendance Statistics', () => {
    it('should calculate average hours', () => {
      const hours = [8, 8.5, 9, 7.5, 8];
      const average = hours.reduce((sum, h) => sum + h, 0) / hours.length;
      expect(average).toBeCloseTo(8.2, 2);
    });

    it('should calculate total overtime', () => {
      const hours = [9, 10, 8, 11, 8.5];
      const totalOvertime = hours.reduce((sum, h) => sum + calculateOvertime(h, 8), 0);
      expect(totalOvertime).toBe(6.5); // 1 + 2 + 0 + 3 + 0.5
    });

    it('should calculate total undertime', () => {
      const hours = [8, 7, 6, 8, 7.5];
      const totalUndertime = hours.reduce((sum, h) => sum + calculateUndertime(h, 8), 0);
      expect(totalUndertime).toBe(3.5); // 0 + 1 + 2 + 0 + 0.5
    });

    it('should count status occurrences', () => {
      const records = [
        { status: 'present' },
        { status: 'present' },
        { status: 'late' },
        { status: 'absent' },
        { status: 'present' }
      ];
      
      const presentCount = records.filter(r => r.status === 'present').length;
      const lateCount = records.filter(r => r.status === 'late').length;
      const absentCount = records.filter(r => r.status === 'absent').length;
      
      expect(presentCount).toBe(3);
      expect(lateCount).toBe(1);
      expect(absentCount).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle midnight crossover', () => {
      // Night shift: 22:00 to 06:00 next day
      // Current implementation doesn't support this, but should return null
      const hours = calculateTotalHours('22:00', '06:00');
      expect(hours).toBeNull(); // Expected behavior for current implementation
    });

    it('should handle zero-length breaks', () => {
      const netHours = calculateNetHours(
        '08:00', '17:00',
        '10:00', '10:00', // Zero-length break
        '12:00', '13:00',
        '15:00', '15:00'  // Zero-length break
      );
      expect(netHours).toBeCloseTo(8, 2); // 9 hours - 1 hour lunch
    });

    it('should handle very short work periods', () => {
      const hours = calculateTotalHours('08:00', '08:30');
      expect(hours).toBe(0.5);
    });

    it('should handle very long work periods', () => {
      const hours = calculateTotalHours('06:00', '23:00');
      expect(hours).toBe(17);
    });
  });
});
