import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth/session';
import { isAuthBypassed } from '@/lib/auth/bypass';
import { getAccessibleModules } from '@/lib/auth/permissions';
import {
  ensureAiAssistantTables,
  explainMonitoringAlertWithAi,
  findMonitoringAlertByIdFromStore,
  getAiAssistantSettings,
  listMonitoringAlertsFromStore,
  resolveAllowedBusinessUnits,
  runDeterministicBusinessMonitor,
  runDeterministicBusinessMonitorIfDue,
  updateMonitoringAlertStatusInStore,
  type AiBusinessUnit,
  type AiToolExecutionContext,
} from '@/lib/ai';

export const dynamic = 'force-dynamic';

async function buildUserToolContext(): Promise<{
  user: { id: string; name?: string | null; role: string } | null;
  toolContext: AiToolExecutionContext;
}> {
  if (isAuthBypassed()) {
    return {
      user: { id: 'dev-bypass', name: 'Dev Admin', role: 'SUPER_ADMIN' },
      toolContext: {
        userId: 'dev-bypass',
        userRole: 'SUPER_ADMIN',
        accessibleModules: [],
        allowedBusinessUnits: ['clothing', 'trucking', 'general-merchandise'],
      },
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      toolContext: {
        userId: null,
        userRole: null,
        accessibleModules: [],
        allowedBusinessUnits: [],
      },
    };
  }

  const accessibleModules = await getAccessibleModules();
  const allowedBusinessUnits = resolveAllowedBusinessUnits(
    user.role,
    accessibleModules
  );

  return {
    user,
    toolContext: {
      userId: user.id,
      userRole: user.role,
      accessibleModules,
      allowedBusinessUnits,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const { user, toolContext } = await buildUserToolContext();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureAiAssistantTables();

    if (toolContext.allowedBusinessUnits.length === 0) {
      return NextResponse.json({ alerts: [], allowedBusinessUnits: [] });
    }

    // Automatically run the 100% local deterministic PostgreSQL monitor if enabled and >15m since last scan
    const settings = await getAiAssistantSettings();
    if (settings.monitoringEnabled) {
      await runDeterministicBusinessMonitorIfDue(15 * 60 * 1000);
    }

    const searchParams = request.nextUrl.searchParams;
    const unitFilter = searchParams.get(
      'businessUnit'
    ) as AiBusinessUnit | null;
    const statusFilter = searchParams.get('status') || 'OPEN';

    const effectiveUnits =
      unitFilter && toolContext.allowedBusinessUnits.includes(unitFilter)
        ? [unitFilter]
        : toolContext.allowedBusinessUnits;

    const alerts = await listMonitoringAlertsFromStore({
      businessUnits: effectiveUnits,
      status: statusFilter,
      limit: 100,
    });

    return NextResponse.json({
      alerts,
      allowedBusinessUnits: toolContext.allowedBusinessUnits,
    });
  } catch (error) {
    logger.error('Failed to fetch AI monitoring alerts', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch AI monitoring alerts',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, toolContext } = await buildUserToolContext();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureAiAssistantTables();

    const body = (await request.json()) as {
      action: 'run-monitor' | 'explain' | 'acknowledge' | 'resolve';
      alertId?: string;
    };

    if (body.action === 'run-monitor') {
      const summary = await runDeterministicBusinessMonitor();
      return NextResponse.json({ summary });
    }

    if (!body.alertId) {
      return NextResponse.json(
        { error: 'alertId is required' },
        { status: 400 }
      );
    }

    if (body.action === 'explain') {
      const explained = await explainMonitoringAlertWithAi({
        alertId: body.alertId,
        toolContext,
        userId: user.id,
        userName: user.name ?? null,
      });
      return NextResponse.json(explained);
    }

    const existing = await findMonitoringAlertByIdFromStore(body.alertId);

    if (!existing) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    if (
      !toolContext.allowedBusinessUnits.includes(
        existing.businessUnit as AiBusinessUnit
      )
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const nextStatus =
      body.action === 'acknowledge' ? 'ACKNOWLEDGED' : 'RESOLVED';

    const updated = await updateMonitoringAlertStatusInStore({
      id: existing.id,
      status: nextStatus,
      acknowledgedBy: user.name || user.id,
    });

    return NextResponse.json({ alert: updated });
  } catch (error) {
    logger.error('Failed to process AI alert action', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to process AI alert action',
      },
      { status: 400 }
    );
  }
}
