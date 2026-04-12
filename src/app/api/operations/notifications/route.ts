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
  month: 'long',
  day: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
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

function inferAction(changes: string): string {
  const lower = changes.toLowerCase();
  if (lower.includes('imported') || lower.includes('bulk import')) {
    return 'Import';
  }
  if (lower.includes('created') || lower.includes('added')) {
    return 'Create';
  }
  if (lower.includes('deleted') || lower.includes('removed')) {
    return 'Delete';
  }
  if (lower.includes('restored')) {
    return 'Restore';
  }
  return 'Update';
}

// Match bare "Updated transaction #NNN" with no meaningful detail
const EMPTY_UPDATE_RE =
  /^Updated (?:transaction|product|shipment) #\d+\s*$/i;

// Match the raw "Updated transaction #NNN - ... - Modified: field: old ---> new" format
// produced by the backend auditLogHelpers / service.ts
const RAW_BACKEND_RE = /- Modified:.*-{2,3}>/;

// The descriptive frontend format uses bullet separators
const DESCRIPTIVE_RE = /\u2022/; // "•"

interface MappedNotification {
  id: string;
  category: string;
  user: string;
  userName: string;
  changes: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  transactionId: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  createdAtDate: string;
  createdAtTime: string;
}

/**
 * Filter out noise from the notification list:
 * 1. Remove empty entries ("Updated transaction #NNN" with no details)
 * 2. Deduplicate: when a descriptive (frontend) and raw (backend) entry
 *    exist for the same entity within the same minute, keep only the
 *    descriptive one.
 */
function deduplicateNotifications(
  notifications: MappedNotification[]
): MappedNotification[] {
  // Fix 3: Remove empty entries
  const meaningful = notifications.filter(
    (n) => !EMPTY_UPDATE_RE.test(n.changes.trim())
  );

  // Fix 2: Deduplicate — group by entity + minute, prefer descriptive
  const minuteGroups = new Map<string, MappedNotification[]>();

  for (const n of meaningful) {
    // Round to same minute for grouping
    const minuteKey = n.createdAt.slice(0, 16); // "2026-04-05T03:19"
    const key = `${n.transactionId ?? 'none'}||${minuteKey}`;

    if (!minuteGroups.has(key)) {
      minuteGroups.set(key, []);
    }
    const group = minuteGroups.get(key);
    if (group) {
      group.push(n);
    }
  }

  const result: MappedNotification[] = [];

  for (const group of Array.from(minuteGroups.values())) {
    if (group.length <= 1) {
      result.push(...group);
      continue;
    }

    // Separate descriptive (frontend) vs raw (backend) entries
    const descriptive: MappedNotification[] = [];
    const raw: MappedNotification[] = [];
    const other: MappedNotification[] = [];

    for (const n of group) {
      if (DESCRIPTIVE_RE.test(n.changes)) {
        descriptive.push(n);
      } else if (RAW_BACKEND_RE.test(n.changes)) {
        raw.push(n);
      } else {
        other.push(n);
      }
    }

    // If we have descriptive entries, drop raw duplicates for the same field
    if (descriptive.length > 0 && raw.length > 0) {
      // Build a set of fields covered by descriptive entries
      const coveredFields = new Set(
        descriptive.map((n) => n.field).filter(Boolean)
      );

      for (const r of raw) {
        // Keep raw entries that cover a field not in descriptive set
        if (r.field && !coveredFields.has(r.field)) {
          result.push(r);
        }
        // Otherwise drop the raw duplicate
      }
      result.push(...descriptive);
    } else {
      result.push(...group);
    }

    result.push(...other);
  }

  // Re-sort by createdAt descending since grouping may have changed order
  result.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return result;
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
      const meta = notification.metadata as Record<string, unknown> | null;

      // Extract structured field data from metadata when available
      const field =
        meta?.column !== null && meta?.column !== undefined
          ? String(meta.column)
          : null;
      const oldValue =
        meta?.previousValue !== null && meta?.previousValue !== undefined
          ? String(meta.previousValue)
          : null;
      const newValue =
        meta?.newValue !== null && meta?.newValue !== undefined
          ? String(meta.newValue)
          : null;

      // Resolve entity identifier for grouping (transaction, product, or shipment)
      const entityId =
        meta?.transactionId !== null && meta?.transactionId !== undefined
          ? String(meta.transactionId)
          : meta?.productId !== null && meta?.productId !== undefined
            ? `product-${meta.productId}`
            : meta?.shipmentId !== null && meta?.shipmentId !== undefined
              ? `shipment-${meta.shipmentId}`
              : null;

      return {
        id: notification.id,
        category: notification.category,
        user: notification.user ?? 'Operations',
        userName: notification.user ?? 'Operations',
        changes: notification.changes,
        field,
        oldValue,
        newValue,
        transactionId: entityId,
        action: inferAction(notification.changes),
        metadata: notification.metadata,
        createdAt: createdAtIso,
        createdAtDate: DATE_FORMATTER.format(createdAt),
        createdAtTime: TIME_FORMATTER.format(createdAt),
      };
    });

    return NextResponse.json(deduplicateNotifications(payload));
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
