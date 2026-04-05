import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  createGeneralMerchandiseEmployeeAutomationRun,
  getGeneralMerchandiseEmployeeAutomationOverview,
  getGeneralMerchandiseEmployeeAutomationSettings,
  updateGeneralMerchandiseEmployeeAutomationSettings,
  type GeneralMerchandiseEmployeeAutomationSettingsUpdate,
} from '@/lib/settings/generalMerchandiseEmployeeAutomation';
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
    const overview = await getGeneralMerchandiseEmployeeAutomationOverview();
    return NextResponse.json(overview);
  } catch (error) {
    logger.error('Error fetching GM employee automation settings:', error);
    return toErrorResponse(
      error,
      'Failed to load employee automation settings.'
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const current = await getGeneralMerchandiseEmployeeAutomationSettings();
    const payload =
      (await request.json()) as GeneralMerchandiseEmployeeAutomationSettingsUpdate;
    const updated =
      await updateGeneralMerchandiseEmployeeAutomationSettings(payload);

    await recordChange(
      {
        entityType: 'employee-automation-settings',
        action: 'update',
        field: 'settings',
        oldValue: current,
        newValue: updated,
        metadata: {
          domain: 'general-merchandise',
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
    logger.error('Error updating GM employee automation settings:', error);
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
    const settings = await getGeneralMerchandiseEmployeeAutomationSettings();
    const result =
      automationType === 'payroll-generation'
        ? await executePayrollAutomation({
            domain: 'general-merchandise',
            settings,
            triggerSource: 'manual',
          })
        : await executeStayInAutomation({
            domain: 'general-merchandise',
            settings,
          });

    const run = await createGeneralMerchandiseEmployeeAutomationRun(
      result,
      'manual',
      {
        userId: user.id ?? null,
        userName: user.name ?? null,
      }
    );

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
          domain: 'general-merchandise',
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
    logger.error('Error running GM stay-in automation manually:', error);
    return toErrorResponse(
      error,
      'Failed to run automation. Please try again later.'
    );
  }
}
