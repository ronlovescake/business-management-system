import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth/session';
import { isAuthBypassed } from '@/lib/auth/bypass';
import {
  RECOMMENDED_MODELS,
  discoverProviderModels,
  ensureAiAssistantTables,
  getAiAssistantSettings,
  listRecentAuditLogsFromStore,
  runSyntheticInvestigationTest,
  testProviderConnection,
  updateAiAssistantSettings,
  type AiProviderId,
} from '@/lib/ai';

export const dynamic = 'force-dynamic';

async function requireAdminOrBypass() {
  if (isAuthBypassed()) {
    return {
      id: 'dev-bypass',
      name: 'Dev Admin',
      role: 'SUPER_ADMIN',
    };
  }
  const user = await getCurrentUser();
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return null;
  }
  return user;
}

export async function GET() {
  try {
    const user = await requireAdminOrBypass();
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await ensureAiAssistantTables();
    const [settings, recentAuditLogs] = await Promise.all([
      getAiAssistantSettings(),
      listRecentAuditLogsFromStore(25),
    ]);

    return NextResponse.json({
      settings,
      recommendedModels: RECOMMENDED_MODELS,
      recentAuditLogs: recentAuditLogs.map((log) => ({
        ...log,
        estimatedCostUsd: Number(log.estimatedCostUsd),
        createdAt: new Date(log.createdAt).toISOString(),
      })),
    });
  } catch (error) {
    logger.error('Failed to load AI assistant settings', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load AI assistant settings',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAdminOrBypass();
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const updated = await updateAiAssistantSettings(body, user.id);

    return NextResponse.json({ settings: updated });
  } catch (error) {
    logger.error('Failed to update AI assistant settings', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update AI assistant settings',
      },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminOrBypass();
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as {
      action?: 'test-connection' | 'test-investigation' | 'discover-models';
      provider?: AiProviderId;
      model?: string;
      ollamaBaseUrl?: string;
    };

    const settings = await getAiAssistantSettings();
    const provider = body.provider ?? settings.activeProvider;
    const model = body.model ?? settings.activeModel;
    const ollamaBaseUrl = body.ollamaBaseUrl ?? settings.ollamaBaseUrl;

    if (body.action === 'discover-models') {
      const models = await discoverProviderModels(provider, ollamaBaseUrl);
      return NextResponse.json({ provider, models });
    }

    if (body.action === 'test-investigation') {
      const result = await runSyntheticInvestigationTest({
        toolContext: {
          userId: user.id,
          userRole: user.role,
          accessibleModules: [],
          allowedBusinessUnits: ['clothing'],
        },
        userId: user.id,
        userName: user.name ?? null,
        providerOverride: provider,
        modelOverride: model,
      });

      return NextResponse.json({ result });
    }

    const connectionResult = await testProviderConnection({
      provider,
      model,
      ollamaBaseUrl,
    });

    return NextResponse.json({ result: connectionResult });
  } catch (error) {
    logger.error('AI assistant action failed', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to execute AI assistant test',
      },
      { status: 400 }
    );
  }
}
