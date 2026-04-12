import { describe, expect, it } from 'vitest';

import { formatLongDateUS } from '@/lib/accounting/formatters';
import { formatPayrollDate } from '@/lib/payroll/formatters';
import { FormatterService } from '@/services/FormatterService';

describe('date wrapper formatters', () => {
  const sampleDate = '2026-02-04T13:45:00.000Z';

  it('keeps accounting and payroll date wrappers aligned', () => {
    expect(formatLongDateUS(sampleDate)).toBe('February 04, 2026');
    expect(formatPayrollDate(sampleDate)).toBe('February 04, 2026');
  });

  it('routes FormatterService date formatting through the canonical output', () => {
    expect(FormatterService.formatDate(sampleDate)).toBe('February 04, 2026');
    expect(FormatterService.formatDateShort(sampleDate)).toBe(
      'February 04, 2026'
    );
    expect(FormatterService.formatTime(sampleDate)).toBe('09:45 PM');
    expect(FormatterService.formatDateTime(sampleDate)).toBe(
      'February 04, 2026 · 09:45 PM'
    );
  });

  it('preserves empty and invalid handling for FormatterService wrappers', () => {
    expect(FormatterService.formatDate(null)).toBe('');
    expect(FormatterService.formatDate('not-a-date')).toBe('');
    expect(FormatterService.formatTime(undefined)).toBe('');
    expect(FormatterService.formatDateTime('not-a-date')).toBe('');
  });
});