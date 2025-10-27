import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDatabaseUrl } from '@/lib/env';
import { MEDIUM_TIMEOUT } from '@/constants/timeouts';

function dbMisconfig(): string | null {
  try {
    const url = getDatabaseUrl();
    if (/postgresql:\/\/username:password@/i.test(url)) {
      return 'DATABASE_URL still has placeholder username/password';
    }
    return null;
  } catch {
    return 'DATABASE_URL is not set';
  }
}

export async function GET() {
  const timestamp = new Date().toISOString();

  const misconfig = dbMisconfig();
  if (misconfig) {
    return NextResponse.json(
      {
        status: 'degraded',
        timestamp,
        database: 'not-configured',
        message: `Database not configured: ${misconfig}`,
        services: { api: 'operational', database: 'misconfigured' },
      },
      { status: 503 }
    );
  }

  try {
    // Try to connect quickly
    const connect = prisma.$connect();
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), MEDIUM_TIMEOUT)
    );
    await Promise.race([connect, timeout]);

    // Simple query to validate
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'healthy',
      timestamp,
      database: 'connected',
      services: { api: 'operational', database: 'operational' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const lower = msg.toLowerCase();
    const reason = lower.includes('authentication failed')
      ? 'authentication failed'
      : lower.includes('connect') || lower.includes('timeout')
        ? 'connection error'
        : 'query error';
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp,
        database: 'error',
        message: msg,
        reason,
      },
      { status: 503 }
    );
  } finally {
    // do not disconnect prisma in app routes
  }
}
