import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  AUDIT_LOG_RETENTION_DAYS,
  CHANGE_LOG_RETENTION_DAYS,
} from '@/constants/limits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function requireInternalToken(req: NextRequest): NextResponse | null {
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

  const provided = (req.headers.get('x-internal-token') || '').trim();
  if (!provided || provided !== expected) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
    );
  }

  return null;
}

export async function POST(request: NextRequest) {
  const authError = requireInternalToken(request);
  if (authError) {
    return authError;
  }

  try {
    const now = new Date();

    const changeLogCutoff = new Date(now);
    changeLogCutoff.setDate(changeLogCutoff.getDate() - CHANGE_LOG_RETENTION_DAYS);

    const auditLogCutoff = new Date(now);
    auditLogCutoff.setDate(auditLogCutoff.getDate() - AUDIT_LOG_RETENTION_DAYS);

    const [changeLogResult, auditLogResult] = await Promise.all([
      prisma.changeLog.deleteMany({
        where: { createdAt: { lt: changeLogCutoff } },
      }),
      prisma.auditLog.deleteMany({
        where: { timestamp: { lt: auditLogCutoff } },
      }),
    ]);

    logger.info('Scheduled log pruning completed', {
      changeLogPruned: changeLogResult.count,
      auditLogPruned: auditLogResult.count,
      changeLogCutoff: changeLogCutoff.toISOString(),
      auditLogCutoff: auditLogCutoff.toISOString(),
      retentionDays: {
        changeLog: CHANGE_LOG_RETENTION_DAYS,
        auditLog: AUDIT_LOG_RETENTION_DAYS,
      },
    });

    return NextResponse.json({
      success: true,
      changeLog: {
        pruned: changeLogResult.count,
        retentionDays: CHANGE_LOG_RETENTION_DAYS,
        cutoff: changeLogCutoff.toISOString(),
      },
      auditLog: {
        pruned: auditLogResult.count,
        retentionDays: AUDIT_LOG_RETENTION_DAYS,
        cutoff: auditLogCutoff.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Scheduled log pruning failed', { error });
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Log pruning failed',
      },
      { status: 500 }
    );
  }
}
