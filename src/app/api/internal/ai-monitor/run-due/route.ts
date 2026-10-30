import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireInternalToken } from '@/lib/internal-jobs/auth';
import { logger } from '@/lib/logger';
import {
  ensureAiAssistantTables,
  getAiAssistantSettings,
  runDeterministicBusinessMonitor,
} from '@/lib/ai';

export const dynamic = 'force-dynamic';

const MIN_INTERVAL_MS = 15 * 60 * 1000;
let lastScheduledRunAtMs = 0;

export async function POST(request: NextRequest) {
  const authError = requireInternalToken(request);
  if (authError) {
    return authError;
  }

  try {
    await ensureAiAssistantTables();
    const settings = await getAiAssistantSettings();

    if (!settings.monitoringEnabled) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'AI monitoring is disabled in Settings.',
      });
    }

    const force = request.nextUrl.searchParams.get('force') === '1';
    const nowMs = Date.now();
    if (!force && nowMs - lastScheduledRunAtMs < MIN_INTERVAL_MS) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Throttled to 15-minute cadence.',
      });
    }

    lastScheduledRunAtMs = nowMs;
    const summary = await runDeterministicBusinessMonitor();
    logger.info('Completed scheduled deterministic AI business monitor run', {
      detectedCount: summary.detectedCount,
      autoResolvedCount: summary.autoResolvedCount,
    });

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    logger.error('Failed to execute internal AI monitoring job', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Internal AI monitoring job failed',
      },
      { status: 500 }
    );
  }
}
