import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizeString, sanitizeObject } from '@/lib/security/sanitize';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

// Database stores Manila time but PostgreSQL returns it with Z marker
// Use UTC timezone to display the timestamp as-is without conversion
const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
  timeZone: 'UTC',
});

type OperationsNotificationRecord = {
  id: string;
  category: string;
  user: string | null;
  changes: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

interface CreateNotificationPayload {
  category?: unknown;
  user?: unknown;
  changes?: unknown;
  metadata?: unknown;
}

function normalizeCategory(rawCategory: unknown): string {
  const sanitized = sanitizeString(rawCategory, {
    maxLength: 50,
  }).toLowerCase();
  return sanitized.length > 0 ? sanitized : 'general';
}

function resolveUserName(rawUser: unknown): string {
  const sanitized = sanitizeString(rawUser, {
    maxLength: 100,
  });
  return sanitized.length > 0 ? sanitized : 'Operations';
}

function sanitizeMetadata(
  metadata: unknown
): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  return sanitizeObject(metadata as Record<string, unknown>, {
    allowSpecialChars: true,
    maxLength: 500,
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawCategory = searchParams.get('category');
    const limitParam = searchParams.get('limit');

    const limit = Math.min(
      Math.max(Number(limitParam) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );

    const categoryFilter = sanitizeString(rawCategory, {
      maxLength: 50,
    }).toLowerCase();

    const notifications = await prisma.$queryRaw<
      OperationsNotificationRecord[]
    >(
      Prisma.sql`
        SELECT id, category, "user", changes, metadata, "createdAt"
        FROM "operations_notifications"
        ${
          categoryFilter && categoryFilter !== 'all'
            ? Prisma.sql`WHERE category = ${categoryFilter}`
            : Prisma.sql``
        }
        ORDER BY "createdAt" DESC
        LIMIT ${limit}
      `
    );

    const payload = notifications.map((notification) => {
      const createdAt = notification.createdAt;
      const createdAtIso = createdAt.toISOString();

      return {
        id: notification.id,
        category: notification.category,
        user: notification.user ?? 'Operations',
        changes: notification.changes,
        metadata: notification.metadata,
        createdAt: createdAtIso,
        createdAtDate: DATE_FORMATTER.format(createdAt),
        createdAtTime: TIME_FORMATTER.format(createdAt),
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    logger.error('Failed to fetch operations notifications:', error);
    return NextResponse.json(
      { error: 'Failed to load operations notifications' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateNotificationPayload;

    const changes = sanitizeString(body.changes, {
      maxLength: 1000,
      allowSpecialChars: true,
    });

    if (!changes) {
      return NextResponse.json(
        { error: 'Changes description is required' },
        { status: 400 }
      );
    }

    const category = normalizeCategory(body.category);
    const user = resolveUserName(body.user);
    const metadata = sanitizeMetadata(body.metadata);

    const id = randomUUID();

    const created = await prisma.operationsNotification.create({
      data: {
        id,
        category,
        user,
        changes,
        ...(metadata
          ? { metadata: metadata as Prisma.InputJsonValue }
          : undefined),
      },
    });

    const createdAt = created.createdAt;
    const responsePayload = {
      id: created.id,
      category: created.category,
      user: created.user,
      changes: created.changes,
      metadata: created.metadata,
      createdAt: createdAt.toISOString(),
      createdAtDate: DATE_FORMATTER.format(createdAt),
      createdAtTime: TIME_FORMATTER.format(createdAt),
    };

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error) {
    logger.error('Failed to create operations notification:', error);
    return NextResponse.json(
      { error: 'Failed to create operations notification' },
      { status: 500 }
    );
  }
}
