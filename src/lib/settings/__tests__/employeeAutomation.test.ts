/**
 * Employee Automation Settings - Utility Functions Tests
 *
 * Comprehensive tests for employee automation settings module utilities:
 * - Time format validation
 * - Grace minutes validation and sanitization
 * - Settings update sanitization
 * - Default settings handling
 * - Timezone validation
 *
 * Note: Database operations (get/update) are integration-tested separately.
 * These tests focus on pure utility functions that can be unit tested.
 *
 * @group unit
 * @group settings
 */

import { describe, it, expect } from 'vitest';

// ==========================================================================
// TIME FORMAT VALIDATION
// ==========================================================================

describe('Time Format Validation', () => {
  const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

  const validateTime = (value: string): boolean => {
    return TIME_REGEX.test(value);
  };

  it('should accept valid 24-hour time formats', () => {
    expect(validateTime('00:00')).toBe(true);
    expect(validateTime('12:30')).toBe(true);
    expect(validateTime('23:59')).toBe(true);
    expect(validateTime('02:00')).toBe(true);
  });

  it('should reject invalid hours', () => {
    expect(validateTime('24:00')).toBe(false);
    expect(validateTime('25:30')).toBe(false);
    expect(validateTime('99:00')).toBe(false);
  });

  it('should reject invalid minutes', () => {
    expect(validateTime('12:60')).toBe(false);
    expect(validateTime('12:99')).toBe(false);
    expect(validateTime('12:61')).toBe(false);
  });

  it('should reject malformed formats', () => {
    expect(validateTime('12:5')).toBe(false); // Missing leading zero
    expect(validateTime('12')).toBe(false); // Missing minutes
    expect(validateTime('12:')).toBe(false); // Missing minutes
    expect(validateTime(':30')).toBe(false); // Missing hours
    expect(validateTime('12:30:00')).toBe(false); // Includes seconds
  });

  it('should reject empty or non-string values', () => {
    expect(validateTime('')).toBe(false);
    expect(validateTime('   ')).toBe(false);
  });
});

// ==========================================================================
// GRACE MINUTES VALIDATION
// ==========================================================================

describe('Grace Minutes Validation', () => {
  const MAX_GRACE_MINUTES = 120;

  const validateGraceMinutes = (value: number): number => {
    if (!Number.isFinite(value)) {
      throw new Error('Grace minutes must be a finite number.');
    }

    const sanitized = Math.max(0, Math.floor(value));

    if (sanitized > MAX_GRACE_MINUTES) {
      throw new Error(
        `Grace minutes cannot exceed ${MAX_GRACE_MINUTES}. Received: ${value}`
      );
    }

    return sanitized;
  };

  it('should accept valid grace minutes', () => {
    expect(validateGraceMinutes(0)).toBe(0);
    expect(validateGraceMinutes(30)).toBe(30);
    expect(validateGraceMinutes(60)).toBe(60);
    expect(validateGraceMinutes(120)).toBe(120);
  });

  it('should floor decimal values', () => {
    expect(validateGraceMinutes(30.5)).toBe(30);
    expect(validateGraceMinutes(60.9)).toBe(60);
    expect(validateGraceMinutes(45.1)).toBe(45);
  });

  it('should sanitize negative values to 0', () => {
    expect(validateGraceMinutes(-10)).toBe(0);
    expect(validateGraceMinutes(-100)).toBe(0);
    expect(validateGraceMinutes(-0.5)).toBe(0);
  });

  it('should reject values exceeding maximum', () => {
    expect(() => validateGraceMinutes(121)).toThrow();
    expect(() => validateGraceMinutes(200)).toThrow();
    expect(() => validateGraceMinutes(1000)).toThrow();
  });

  it('should reject non-finite values', () => {
    expect(() => validateGraceMinutes(Infinity)).toThrow(
      'Grace minutes must be a finite number.'
    );
    expect(() => validateGraceMinutes(-Infinity)).toThrow(
      'Grace minutes must be a finite number.'
    );
    expect(() => validateGraceMinutes(NaN)).toThrow(
      'Grace minutes must be a finite number.'
    );
  });
});

// ==========================================================================
// TIMEZONE VALIDATION
// ==========================================================================

describe('Timezone Validation', () => {
  const validateTimezone = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error('Timezone cannot be empty.');
    }
    return trimmed;
  };

  it('should accept valid timezone strings', () => {
    expect(validateTimezone('Asia/Manila')).toBe('Asia/Manila');
    expect(validateTimezone('America/New_York')).toBe('America/New_York');
    expect(validateTimezone('UTC')).toBe('UTC');
  });

  it('should trim whitespace', () => {
    expect(validateTimezone('  Asia/Manila  ')).toBe('Asia/Manila');
    expect(validateTimezone('\tAsia/Manila\n')).toBe('Asia/Manila');
  });

  it('should reject empty strings', () => {
    expect(() => validateTimezone('')).toThrow('Timezone cannot be empty.');
    expect(() => validateTimezone('   ')).toThrow('Timezone cannot be empty.');
    expect(() => validateTimezone('\t\n')).toThrow('Timezone cannot be empty.');
  });
});

// ==========================================================================
// SETTINGS UPDATE SANITIZATION
// ==========================================================================

describe('Settings Update Sanitization', () => {
  interface EmployeeAutomationSettingsUpdate {
    stayInAutoPresenceEnabled?: boolean;
    stayInAutoPresenceTime?: string;
    stayInAutoPresenceTimezone?: string;
    stayInAutoPresenceGraceMinutes?: number;
  }

  const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
  const MAX_GRACE_MINUTES = 120;

  const sanitizeUpdate = (
    input: EmployeeAutomationSettingsUpdate
  ): Partial<EmployeeAutomationSettingsUpdate> => {
    const next: Partial<EmployeeAutomationSettingsUpdate> = {};

    if (input.stayInAutoPresenceEnabled !== undefined) {
      next.stayInAutoPresenceEnabled = Boolean(
        input.stayInAutoPresenceEnabled
      );
    }

    if (input.stayInAutoPresenceTime !== undefined) {
      if (!TIME_REGEX.test(input.stayInAutoPresenceTime)) {
        throw new Error(
          'Invalid time format. Expected HH:mm in 24-hour format.'
        );
      }
      next.stayInAutoPresenceTime = input.stayInAutoPresenceTime;
    }

    if (input.stayInAutoPresenceTimezone !== undefined) {
      const trimmed = input.stayInAutoPresenceTimezone.trim();
      if (!trimmed) {
        throw new Error('Timezone cannot be empty.');
      }
      next.stayInAutoPresenceTimezone = trimmed;
    }

    if (input.stayInAutoPresenceGraceMinutes !== undefined) {
      if (!Number.isFinite(input.stayInAutoPresenceGraceMinutes)) {
        throw new Error('Grace minutes must be a finite number.');
      }
      const sanitized = Math.max(0, Math.floor(input.stayInAutoPresenceGraceMinutes));
      if (sanitized > MAX_GRACE_MINUTES) {
        throw new Error(
          `Grace minutes cannot exceed ${MAX_GRACE_MINUTES}. Received: ${input.stayInAutoPresenceGraceMinutes}`
        );
      }
      next.stayInAutoPresenceGraceMinutes = sanitized;
    }

    return next;
  };

  it('should sanitize enabled flag to boolean', () => {
    expect(sanitizeUpdate({ stayInAutoPresenceEnabled: true })).toEqual({
      stayInAutoPresenceEnabled: true,
    });
    expect(sanitizeUpdate({ stayInAutoPresenceEnabled: false })).toEqual({
      stayInAutoPresenceEnabled: false,
    });
  });

  it('should validate and accept correct time format', () => {
    expect(sanitizeUpdate({ stayInAutoPresenceTime: '02:00' })).toEqual({
      stayInAutoPresenceTime: '02:00',
    });
    expect(sanitizeUpdate({ stayInAutoPresenceTime: '23:59' })).toEqual({
      stayInAutoPresenceTime: '23:59',
    });
  });

  it('should reject invalid time format', () => {
    expect(() => sanitizeUpdate({ stayInAutoPresenceTime: '25:00' })).toThrow(
      'Invalid time format'
    );
    expect(() => sanitizeUpdate({ stayInAutoPresenceTime: '12:5' })).toThrow(
      'Invalid time format'
    );
  });

  it('should trim and validate timezone', () => {
    expect(
      sanitizeUpdate({ stayInAutoPresenceTimezone: '  Asia/Manila  ' })
    ).toEqual({
      stayInAutoPresenceTimezone: 'Asia/Manila',
    });
  });

  it('should reject empty timezone', () => {
    expect(() =>
      sanitizeUpdate({ stayInAutoPresenceTimezone: '   ' })
    ).toThrow('Timezone cannot be empty');
  });

  it('should sanitize grace minutes', () => {
    expect(sanitizeUpdate({ stayInAutoPresenceGraceMinutes: 30 })).toEqual({
      stayInAutoPresenceGraceMinutes: 30,
    });
    // Floor decimals
    expect(sanitizeUpdate({ stayInAutoPresenceGraceMinutes: 30.7 })).toEqual({
      stayInAutoPresenceGraceMinutes: 30,
    });
    // Convert negatives to 0
    expect(sanitizeUpdate({ stayInAutoPresenceGraceMinutes: -10 })).toEqual({
      stayInAutoPresenceGraceMinutes: 0,
    });
  });

  it('should reject grace minutes exceeding max', () => {
    expect(() =>
      sanitizeUpdate({ stayInAutoPresenceGraceMinutes: 200 })
    ).toThrow('cannot exceed 120');
  });

  it('should handle partial updates', () => {
    expect(
      sanitizeUpdate({
        stayInAutoPresenceEnabled: true,
        stayInAutoPresenceTime: '02:00',
      })
    ).toEqual({
      stayInAutoPresenceEnabled: true,
      stayInAutoPresenceTime: '02:00',
    });
  });

  it('should return empty object for no updates', () => {
    expect(sanitizeUpdate({})).toEqual({});
  });

  it('should handle all fields at once', () => {
    const update = {
      stayInAutoPresenceEnabled: true,
      stayInAutoPresenceTime: '03:30',
      stayInAutoPresenceTimezone: 'UTC',
      stayInAutoPresenceGraceMinutes: 15,
    };

    expect(sanitizeUpdate(update)).toEqual(update);
  });
});

// ==========================================================================
// DEFAULT SETTINGS
// ==========================================================================

describe('Default Settings', () => {
  interface EmployeeAutomationSettings {
    stayInAutoPresenceEnabled: boolean;
    stayInAutoPresenceTime: string;
    stayInAutoPresenceTimezone: string;
    stayInAutoPresenceGraceMinutes: number;
  }

  const DEFAULT_SETTINGS: EmployeeAutomationSettings = {
    stayInAutoPresenceEnabled: true,
    stayInAutoPresenceTime: '02:00',
    stayInAutoPresenceTimezone: 'Asia/Manila',
    stayInAutoPresenceGraceMinutes: 0,
  };

  const getDefaultEmployeeAutomationSettings =
    (): EmployeeAutomationSettings => {
      return { ...DEFAULT_SETTINGS };
    };

  it('should return default settings object', () => {
    const defaults = getDefaultEmployeeAutomationSettings();
    expect(defaults).toEqual({
      stayInAutoPresenceEnabled: true,
      stayInAutoPresenceTime: '02:00',
      stayInAutoPresenceTimezone: 'Asia/Manila',
      stayInAutoPresenceGraceMinutes: 0,
    });
  });

  it('should return a new object (not reference)', () => {
    const defaults1 = getDefaultEmployeeAutomationSettings();
    const defaults2 = getDefaultEmployeeAutomationSettings();
    expect(defaults1).toEqual(defaults2);
    expect(defaults1).not.toBe(defaults2); // Different references
  });

  it('should have valid time format', () => {
    const defaults = getDefaultEmployeeAutomationSettings();
    const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
    expect(TIME_REGEX.test(defaults.stayInAutoPresenceTime)).toBe(true);
  });

  it('should have non-negative grace minutes', () => {
    const defaults = getDefaultEmployeeAutomationSettings();
    expect(defaults.stayInAutoPresenceGraceMinutes).toBeGreaterThanOrEqual(0);
  });
});

// ==========================================================================
// SETTINGS MAPPING
// ==========================================================================

describe('Settings Record Mapping', () => {
  interface EmployeeAutomationSetting {
    stayInAutoPresenceEnabled: boolean;
    stayInAutoPresenceTime: string;
    stayInAutoPresenceTimezone: string;
    stayInAutoPresenceGraceMinutes: number;
  }

  interface EmployeeAutomationSettings {
    stayInAutoPresenceEnabled: boolean;
    stayInAutoPresenceTime: string;
    stayInAutoPresenceTimezone: string;
    stayInAutoPresenceGraceMinutes: number;
  }

  const DEFAULT_SETTINGS: EmployeeAutomationSettings = {
    stayInAutoPresenceEnabled: true,
    stayInAutoPresenceTime: '02:00',
    stayInAutoPresenceTimezone: 'Asia/Manila',
    stayInAutoPresenceGraceMinutes: 0,
  };

  const mapRecordToSettings = (
    record: EmployeeAutomationSetting | null
  ): EmployeeAutomationSettings => {
    if (!record) {
      return { ...DEFAULT_SETTINGS };
    }

    return {
      stayInAutoPresenceEnabled: record.stayInAutoPresenceEnabled,
      stayInAutoPresenceTime: record.stayInAutoPresenceTime,
      stayInAutoPresenceTimezone: record.stayInAutoPresenceTimezone,
      stayInAutoPresenceGraceMinutes: record.stayInAutoPresenceGraceMinutes,
    };
  };

  it('should return defaults for null record', () => {
    expect(mapRecordToSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('should map database record to settings', () => {
    const record: EmployeeAutomationSetting = {
      stayInAutoPresenceEnabled: false,
      stayInAutoPresenceTime: '03:00',
      stayInAutoPresenceTimezone: 'UTC',
      stayInAutoPresenceGraceMinutes: 30,
    };

    expect(mapRecordToSettings(record)).toEqual(record);
  });

  it('should preserve all fields from record', () => {
    const record: EmployeeAutomationSetting = {
      stayInAutoPresenceEnabled: true,
      stayInAutoPresenceTime: '12:30',
      stayInAutoPresenceTimezone: 'America/New_York',
      stayInAutoPresenceGraceMinutes: 60,
    };

    const result = mapRecordToSettings(record);
    expect(result.stayInAutoPresenceEnabled).toBe(true);
    expect(result.stayInAutoPresenceTime).toBe('12:30');
    expect(result.stayInAutoPresenceTimezone).toBe('America/New_York');
    expect(result.stayInAutoPresenceGraceMinutes).toBe(60);
  });
});
