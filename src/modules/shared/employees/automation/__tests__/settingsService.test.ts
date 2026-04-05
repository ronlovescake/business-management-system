import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS,
  sanitizeEmployeeAutomationSettingsUpdate,
} from '../settingsService';

describe('sanitizeEmployeeAutomationSettingsUpdate', () => {
  it('sorts and deduplicates payroll cutoff days', () => {
    expect(
      sanitizeEmployeeAutomationSettingsUpdate({
        payrollAutoGenerationCutoffDays: [30, 15, 30],
      })
    ).toMatchObject({
      payrollAutoGenerationCutoffDays: [15, 30],
    });
  });

  it('keeps payroll cutoff days empty in the default settings until configured', () => {
    expect(
      DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS.payrollAutoGenerationCutoffDays
    ).toEqual([]);
  });

  it('rejects cutoff days outside the valid calendar range', () => {
    expect(() =>
      sanitizeEmployeeAutomationSettingsUpdate({
        payrollAutoGenerationCutoffDays: [0, 15],
      })
    ).toThrow('Payroll cutoff dates must be between 1 and 31.');
  });
});
