import type { NextRequest } from 'next/server';
import type { EmployeeAutomationExecutionResult } from './types';
import { requireInternalToken as requireSharedInternalToken } from '@/lib/internal-jobs/auth';

type SkipMetadata = {
  skipReason?: string;
};

function getSkipMetadata(
  result: EmployeeAutomationExecutionResult
): SkipMetadata | null {
  if (!result.metadata || typeof result.metadata !== 'object') {
    return null;
  }

  return result.metadata as SkipMetadata;
}

export function requireInternalToken(request: NextRequest) {
  return requireSharedInternalToken(request);
}

export function shouldPersistScheduledRun(
  result: EmployeeAutomationExecutionResult
): boolean {
  const skipReason = getSkipMetadata(result)?.skipReason;
  return (
    skipReason !== 'disabled' &&
    skipReason !== 'already-recorded-run' &&
    skipReason !== 'no-due-cutoff'
  );
}

export function summarizeScheduledResults(
  results: EmployeeAutomationExecutionResult[]
) {
  return {
    executed: results.filter((result) => shouldPersistScheduledRun(result))
      .length,
    succeeded: results.filter((result) => result.status === 'success').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    failed: results.filter((result) => result.status === 'error').length,
  };
}
