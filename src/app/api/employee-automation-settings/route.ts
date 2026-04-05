import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  createEmployeeAutomationRun,
  getEmployeeAutomationOverview,
  getEmployeeAutomationSettings,
  updateEmployeeAutomationSettings,
  type EmployeeAutomationSettingsUpdate,
} from '@/lib/settings/employeeAutomation';
import { requireAdmin } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import {
  executePayrollAutomation,
  executeStayInAutomation,
  type EmployeeAutomationType,
} from '@/modules/shared/employees/automation';
import { recordChange } from '@/core/change-log';

function parseAutomationType(value: unknown): EmployeeAutomationType {
  if (value === 'stay-in-attendance' || value === 'payroll-generation') {
    return value;
  }

  const error = new Error('Invalid automation type.');
  error.name = 'ValidationError';
  throw error;
}

function toErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message === 'Unauthorized') {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 }
    );
  }

  if (error instanceof Error && error.name === 'SchemaMismatchError') {
    return NextResponse.json({ error: error.message }, { status: 503 });
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

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function GET() {
  try {
    await requireAdmin();
    const overview = await getEmployeeAutomationOverview();
    return NextResponse.json(overview);
  } catch (error) {
    logger.error('Error fetching employee automation settings:', error);
    return toErrorResponse(
      error,
      'Failed to load employee automation settings.'
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const current = await getEmployeeAutomationSettings();
    const payload = (await request.json()) as EmployeeAutomationSettingsUpdate;
    const updated = await updateEmployeeAutomationSettings(payload);

    await recordChange(
      {
        entityType: 'employee-automation-settings',
        action: 'update',
        field: 'settings',
        oldValue: current,
        newValue: updated,
        metadata: {
          domain: 'clothing',
        },
      },
      {
        userId: user.id ?? null,
        userName: user.name ?? null,
        source: 'employee-automation-settings',
      }
    );

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error updating employee automation settings:', error);
    return toErrorResponse(
      error,
      'Failed to update employee automation settings.'
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();

    const body = (await request.json().catch(() => ({}))) as {
      automationType?: unknown;
    };
    const automationType = parseAutomationType(body.automationType);
    const settings = await getEmployeeAutomationSettings();
    const result =
      automationType === 'payroll-generation'
        ? await executePayrollAutomation({
            domain: 'clothing',
            settings,
            triggerSource: 'manual',
          })
        : await executeStayInAutomation({ domain: 'clothing', settings });

    const run = await createEmployeeAutomationRun(result, 'manual', {
      userId: user.id ?? null,
      userName: user.name ?? null,
    });

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
          domain: 'clothing',
          triggerSource: 'manual',
        },
      },
      {
        userId: user.id ?? null,
        userName: user.name ?? null,
        source: 'employee-automation-settings',
      }
    );

    return NextResponse.json({
      success: result.status !== 'error',
      result,
      run,
    });
  } catch (error) {
    logger.error('Error running stay-in automation manually:', error);
    return toErrorResponse(
      error,
      'Failed to run automation. Please try again later.'
    );
  }
}
