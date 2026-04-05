import { describe, expect, it } from 'vitest';
import { getDuePayrollAutomationPeriod } from '../scheduling';

describe('getDuePayrollAutomationPeriod', () => {
  it('returns the same current payroll period the manual button would use on the due cutoff date', () => {
    const period = getDuePayrollAutomationPeriod({
      scheduleTime: '02:00',
      timezone: 'Asia/Manila',
      cutoffDays: [5],
      referenceTime: '2026-04-05T14:53:00+08:00',
    });

    expect(period).toMatchObject({
      periodStart: '2026-04-01',
      periodEnd: '2026-04-15',
      periodKey: '2026-04-01:2026-04-15',
      cutoffDate: '2026-04-05',
    });
  });

  it('preserves the due cutoff date period during catch-up after the configured time has passed', () => {
    const period = getDuePayrollAutomationPeriod({
      scheduleTime: '02:00',
      timezone: 'Asia/Manila',
      cutoffDays: [30],
      referenceTime: '2026-05-02T10:00:00+08:00',
    });

    expect(period).toMatchObject({
      periodStart: '2026-04-16',
      periodEnd: '2026-04-30',
      periodKey: '2026-04-16:2026-04-30',
      cutoffDate: '2026-04-30',
    });
  });

  it('clamps late-month cutoff days to month-end for shorter months', () => {
    const period = getDuePayrollAutomationPeriod({
      scheduleTime: '02:00',
      timezone: 'Asia/Manila',
      cutoffDays: [15, 31],
      referenceTime: '2026-02-28T03:00:00+08:00',
    });

    expect(period).toMatchObject({
      periodStart: '2026-02-16',
      periodEnd: '2026-02-28',
      periodKey: '2026-02-16:2026-02-28',
      cutoffDate: '2026-02-28',
    });
  });

  it('returns null when no cutoff days are configured', () => {
    expect(
      getDuePayrollAutomationPeriod({
        scheduleTime: '02:00',
        timezone: 'Asia/Manila',
        cutoffDays: [],
        referenceTime: '2026-02-28T03:00:00+08:00',
      })
    ).toBeNull();
  });
});
