import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { recordChange } from '@/core/change-log';
import {
  createTruckingEmployeeAutomationRun,
  getTruckingEmployeeAutomationSettings,
} from '@/lib/settings/truckingEmployeeAutomation';
import { logger } from '@/lib/logger';
import {
  executeDueAutomations,
  type EmployeeAutomationExecutionResult,
} from '@/modules/shared/employees/automation';
import {
  requireInternalToken,
  shouldPersistScheduledRun,
  summarizeScheduledResults,
} from '@/modules/shared/employees/automation/internalRouteUtils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function persistResult(result: EmployeeAutomationExecutionResult) {
  if (!shouldPersistScheduledRun(result)) {
    return null;
  }

  const run = await createTruckingEmployeeAutomationRun(result, 'scheduler');
  await recordChange(
    {
      entityType: 'employee-automation-run',
      action: 'run',
      field: result.automationType,
      newValue: {
        status: result.status,
        message: result.message,
        periodKey: result.periodKey ?? null,
      },
      metadata: {
        domain: 'trucking',
        triggerSource: 'scheduler',
      },
    },
    {
      source: 'employee-automation-scheduler',
    }
  );

  return run;
}

export async function POST(request: NextRequest) {
  const authError = requireInternalToken(request);
  if (authError) {
    return authError;
  }

  try {
    const settings = await getTruckingEmployeeAutomationSettings();
    const results = await executeDueAutomations({
      domain: 'trucking',
      settings,
    });

    const persistedRuns = (
      await Promise.all(
        results.map((result: EmployeeAutomationExecutionResult) =>
          persistResult(result)
        )
      )
    ).filter(Boolean);

    return NextResponse.json({
      success: results.every(
        (result: EmployeeAutomationExecutionResult) => result.status !== 'error'
      ),
      summary: summarizeScheduledResults(results),
      persistedRuns: persistedRuns.length,
      results,
    });
  } catch (error) {
    logger.error('Internal trucking employee automation scheduler failed', {
      error,
    });
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Employee automation scheduler failed',
      },
      { status: 500 }
    );
  }
}
