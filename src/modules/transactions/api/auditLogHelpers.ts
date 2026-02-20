import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth/session';
import {
  recordChange,
  recordChanges,
  type ChangeLogEntryInput,
} from '@/core/change-log';

async function resolveChangeLogContext(source: string) {
  try {
    const user = await getCurrentUser();
    return {
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      source,
    } as const;
  } catch (error) {
    logger.warn('Unable to resolve user context for change log', {
      source,
      error,
    });
    return {
      userId: null,
      userName: null,
      source,
    } as const;
  }
}

export async function logOperationNotification(
  category: string,
  changes: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const id = randomUUID();
    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
    const philippineTime = new Date(now);

    await prisma.$executeRaw`
      INSERT INTO "operations_notifications" (id, category, "user", changes, metadata, "createdAt")
      VALUES (${id}, ${category}, ${'Operations'}, ${changes}, ${metadataJson}::jsonb, ${philippineTime})
    `;
  } catch (error) {
    logger.warn('Failed to log operations notification', { error, category });
  }
}

export async function logImportChange(
  count: number,
  withData: number,
  empty: number,
  templateSkipped = 0
): Promise<void> {
  try {
    const context = await resolveChangeLogContext('transactions:import');
    await recordChange(
      {
        entityType: 'transaction',
        action: 'import',
        field: 'bulkImport',
        oldValue: null,
        newValue: {
          count,
          withData,
          empty,
          templateSkipped,
        },
        metadata: {
          emptyRows: empty,
          templateRows: templateSkipped,
        },
      },
      context
    );
  } catch (error) {
    logger.warn('Failed to record change log for transaction import', {
      error,
    });
  }
}

export async function logUpdateChanges(
  entries: ChangeLogEntryInput[],
  source: string
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  try {
    const context = await resolveChangeLogContext(source);
    await recordChanges(entries, context);
  } catch (error) {
    logger.warn('Failed to record change log entries', { error, source });
  }
}
