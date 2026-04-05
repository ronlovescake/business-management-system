import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { EmployeeAutomationExecutionResult } from './types';

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

export function requireInternalToken(
  request: NextRequest
): NextResponse | null {
  const expected = (process.env.INTERNAL_JOB_TOKEN || '').trim();
  if (!expected) {
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_JOB_TOKEN is not configured on the server',
      },
      { status: 500 }
    );
  }

  const provided = (request.headers.get('x-internal-token') || '').trim();
  if (!provided || provided !== expected) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
    );
  }

  return null;
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
