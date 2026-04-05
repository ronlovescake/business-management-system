import { describe, expect, it } from 'vitest';
import { shouldPersistScheduledRun } from '../internalRouteUtils';
import type { EmployeeAutomationExecutionResult } from '../types';

function buildResult(
  overrides: Partial<EmployeeAutomationExecutionResult> = {}
): EmployeeAutomationExecutionResult {
  return {
    automationType: 'payroll-generation',
    status: 'skipped',
    message: 'Skipped.',
    processed: 0,
    inserted: 0,
    skipped: 0,
    ...overrides,
  };
}

describe('shouldPersistScheduledRun', () => {
  it('does not persist disabled scheduled runs', () => {
    expect(
      shouldPersistScheduledRun(
        buildResult({ metadata: { skipReason: 'disabled' } })
      )
    ).toBe(false);
  });

  it('does not persist already-recorded scheduled runs', () => {
    expect(
      shouldPersistScheduledRun(
        buildResult({ metadata: { skipReason: 'already-recorded-run' } })
      )
    ).toBe(false);
  });

  it('does not persist payroll checks with no due cutoff yet', () => {
    expect(
      shouldPersistScheduledRun(
        buildResult({ metadata: { skipReason: 'no-due-cutoff' } })
      )
    ).toBe(false);
  });

  it('persists successful scheduled runs', () => {
    expect(
      shouldPersistScheduledRun(
        buildResult({ status: 'success', message: 'Generated payroll.' })
      )
    ).toBe(true);
  });

  it('persists meaningful skipped runs without an ignored skip reason', () => {
    expect(
      shouldPersistScheduledRun(
        buildResult({
          message: 'No stay-in attendance catch-up entries were needed.',
        })
      )
    ).toBe(true);
  });
});
