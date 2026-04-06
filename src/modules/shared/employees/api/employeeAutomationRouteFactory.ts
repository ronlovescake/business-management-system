import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/core/api/middleware';
import { recordChange } from '@/core/change-log';
import { requireAdmin } from '@/lib/auth/session';
import {
  executePayrollAutomation,
  executeStayInAutomation,
  type EmployeeAutomationDomain,
  type EmployeeAutomationExecutionResult,
  type EmployeeAutomationOverview,
  type EmployeeAutomationRunRecord,
  type EmployeeAutomationSettings,
  type EmployeeAutomationSettingsUpdate,
  type EmployeeAutomationTriggerSource,
  type EmployeeAutomationType,
} from '@/modules/shared/employees/automation';

type Actor = {
  userId?: string | null;
  userName?: string | null;
};

interface EmployeeAutomationRouteConfig<
  TUpdate extends
    EmployeeAutomationSettingsUpdate = EmployeeAutomationSettingsUpdate,
> {
  domain: EmployeeAutomationDomain;
  createRun: (
    result: EmployeeAutomationExecutionResult,
    triggerSource: EmployeeAutomationTriggerSource,
    actor?: Actor
  ) => Promise<EmployeeAutomationRunRecord>;
  getOverview: () => Promise<EmployeeAutomationOverview>;
  getSettings: () => Promise<EmployeeAutomationSettings>;
  updateSettings: (input: TUpdate) => Promise<EmployeeAutomationSettings>;
}

const MANUAL_TRIGGER_SOURCE: EmployeeAutomationTriggerSource = 'manual';

function parseAutomationType(value: unknown): EmployeeAutomationType {
  if (value === 'stay-in-attendance' || value === 'payroll-generation') {
    return value;
  }

  const error = new Error('Invalid automation type.');
  error.name = 'ValidationError';
  throw error;
}

function toEmployeeAutomationErrorResponse(
  error: unknown,
  fallbackMessage: string
): NextResponse {
  if (error instanceof Error && error.message === 'Unauthorized') {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 }
    );
  }

  if (
    error instanceof Error &&
    error.message.startsWith('Forbidden: Insufficient permissions')
  ) {
    return NextResponse.json(
      { error: 'Insufficient permissions.' },
      { status: 403 }
    );
  }

  if (error instanceof Error && error.name === 'ValidationError') {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof Error && error.name === 'SchemaMismatchError') {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export function createEmployeeAutomationSettingsRoutes<
  TUpdate extends
    EmployeeAutomationSettingsUpdate = EmployeeAutomationSettingsUpdate,
>(config: EmployeeAutomationRouteConfig<TUpdate>) {
  const GET = withErrorHandler(
    async (_request: NextRequest) => {
      await requireAdmin();
      const overview = await config.getOverview();
      return NextResponse.json(overview);
    },
    {
      onError: (error, request) =>
        toEmployeeAutomationErrorResponse(
          error,
          request.method === 'GET'
            ? 'Failed to load employee automation settings.'
            : 'Failed to process employee automation request.'
        ),
    }
  );

  const PUT = withErrorHandler(
    async (request: NextRequest) => {
      const user = await requireAdmin();
      const current = await config.getSettings();
      const payload = (await request.json()) as TUpdate;
      const updated = await config.updateSettings(payload);

      await recordChange(
        {
          entityType: 'employee-automation-settings',
          action: 'update',
          field: 'settings',
          oldValue: current,
          newValue: updated,
          metadata: {
            domain: config.domain,
          },
        },
        {
          userId: user.id ?? null,
          userName: user.name ?? null,
          source: 'employee-automation-settings',
        }
      );

      return NextResponse.json(updated);
    },
    {
      onError: (error) =>
        toEmployeeAutomationErrorResponse(
          error,
          'Failed to update employee automation settings.'
        ),
    }
  );

  const POST = withErrorHandler(
    async (request: NextRequest) => {
      const user = await requireAdmin();
      const body = (await request.json().catch(() => ({}))) as {
        automationType?: unknown;
      };
      const automationType = parseAutomationType(body.automationType);
      const settings = await config.getSettings();
      const result =
        automationType === 'payroll-generation'
          ? await executePayrollAutomation({
              domain: config.domain,
              settings,
              triggerSource: MANUAL_TRIGGER_SOURCE,
            })
          : await executeStayInAutomation({
              domain: config.domain,
              settings,
            });

      const actor = {
        userId: user.id ?? null,
        userName: user.name ?? null,
      };
      const run = await config.createRun(result, MANUAL_TRIGGER_SOURCE, actor);

      await recordChange(
        {
          entityType: 'employee-automation-run',
          action: 'run',
          field: automationType,
          newValue: {
            status: result.status,
            message: result.message,
            periodKey: result.periodKey ?? null,
          },
          metadata: {
            domain: config.domain,
            triggerSource: MANUAL_TRIGGER_SOURCE,
          },
        },
        {
          userId: actor.userId,
          userName: actor.userName,
          source: 'employee-automation-settings',
        }
      );

      return NextResponse.json({
        success: result.status !== 'error',
        result,
        run,
      });
    },
    {
      onError: (error) =>
        toEmployeeAutomationErrorResponse(
          error,
          'Failed to run automation. Please try again later.'
        ),
    }
  );

  return { GET, PUT, POST };
}
