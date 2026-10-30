import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth/session';
import { isAuthBypassed } from '@/lib/auth/bypass';
import { getAccessibleModules } from '@/lib/auth/permissions';
import {
  ensureAiAssistantTables,
  listMonitoringAlertsFromStore,
  resolveAllowedBusinessUnits,
  runBusinessAiAssistant,
  runDeterministicBusinessMonitor,
  type AiBusinessUnit,
  type AiToolExecutionContext,
} from '@/lib/ai';

export const dynamic = 'force-dynamic';

const MAX_HISTORY_TURNS = 12;
const MAX_HISTORY_MESSAGE_CHARS = 4000;

/**
 * Keep only well-formed user/assistant turns, truncate long messages, and cap
 * the number of turns so multi-turn chat stays within token budgets.
 */
function sanitizeChatHistory(
  raw: unknown
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(
      (m): m is { role: 'user' | 'assistant'; content: string } =>
        Boolean(m) &&
        typeof m === 'object' &&
        ((m as { role?: unknown }).role === 'user' ||
          (m as { role?: unknown }).role === 'assistant') &&
        typeof (m as { content?: unknown }).content === 'string' &&
        (m as { content: string }).content.trim().length > 0
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_HISTORY_MESSAGE_CHARS),
    }));
}

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
        userEmail: 'dev@local',
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
        userEmail: null,
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
      userEmail: user.email,
      accessibleModules,
      allowedBusinessUnits,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const { user, toolContext } = await buildUserToolContext();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureAiAssistantTables();

    const body = (await request.json()) as {
      action?: 'chat' | 'briefing';
      question?: string;
      businessUnit?: AiBusinessUnit;
      history?: unknown;
    };

    const targetUnit =
      body.businessUnit &&
      toolContext.allowedBusinessUnits.includes(body.businessUnit)
        ? body.businessUnit
        : undefined;

    if (body.action === 'briefing') {
      await runDeterministicBusinessMonitor();
      const unitsToSummarize = targetUnit
        ? [targetUnit]
        : toolContext.allowedBusinessUnits;

      const openAlerts = await listMonitoringAlertsFromStore({
        businessUnits: unitsToSummarize,
        status: 'OPEN',
        limit: 40,
      });

      const deterministicBriefingLines: string[] = [
        `Deterministic Business Briefing (${new Date().toISOString().slice(0, 10)})`,
        `Total Open Alerts across authorized units: ${openAlerts.length}`,
      ];

      for (const unit of unitsToSummarize) {
        const unitAlerts = openAlerts.filter((a) => a.businessUnit === unit);
        deterministicBriefingLines.push(
          `\n### ${unit.toUpperCase()} (${unitAlerts.length} open alerts)`
        );
        if (unitAlerts.length === 0) {
          deterministicBriefingLines.push(
            '- No overdue invoices, accounting mismatches, or negative stock detected.'
          );
        } else {
          for (const alert of unitAlerts.slice(0, 8)) {
            deterministicBriefingLines.push(
              `- [${alert.severity}] ${alert.title}: ${alert.deterministicSummary} (${alert.sourceLink ?? ''})`
            );
          }
        }
      }

      const deterministicText = deterministicBriefingLines.join('\n');

      try {
        const aiBriefing = await runBusinessAiAssistant({
          userPrompt: [
            'Generate a concise Morning Executive Briefing separated by business unit based on the following deterministic scan findings.',
            'Highlight top urgent actions, exact amounts, and record IDs, and remind the team which module links to check:',
            '',
            deterministicText,
          ].join('\n'),
          triggerSource: 'SCHEDULED_BRIEFING',
          toolContext,
          userId: user.id,
          userName: user.name ?? null,
          businessUnit: targetUnit,
          enableTools: false,
        });

        return NextResponse.json({
          briefing: aiBriefing.text,
          deterministicFallback: false,
          generation: aiBriefing,
          openAlertCount: openAlerts.length,
        });
      } catch (aiError) {
        return NextResponse.json({
          briefing: deterministicText,
          deterministicFallback: true,
          fallbackReason:
            aiError instanceof Error
              ? aiError.message
              : 'AI provider offline; showing deterministic briefing.',
          openAlertCount: openAlerts.length,
        });
      }
    }

    const question = (body.question || '').trim();
    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    const generation = await runBusinessAiAssistant({
      userPrompt: question,
      history: sanitizeChatHistory(body.history),
      triggerSource: 'USER_CHAT',
      toolContext,
      userId: user.id,
      userName: user.name ?? null,
      businessUnit: targetUnit,
      enableTools: true,
    });

    return NextResponse.json({ generation });
  } catch (error) {
    logger.error('Failed to process AI assistant chat request', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to process AI assistant request',
      },
      { status: 400 }
    );
  }
}
