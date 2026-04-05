import type { AuditLog } from '@prisma/client';
import { prisma } from '@/lib/db';
import { SELECTIVE_BACKUP_TABLES } from '@/lib/backup/backupModelRegistry';

const WRITE_ACTIONS = [
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
] as const;

export interface AuditLogQuery {
  entityType: string;
  entityId: string;
  eventTime?: Date;
  action?: string;
  limit?: number;
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function maybeSingularize(value: string) {
  return value.endsWith('s') ? value.slice(0, -1) : value;
}

function resolveAuditModels(entityType: string) {
  const normalized = normalizeToken(entityType);
  const singular = maybeSingularize(normalized);

  const matches = SELECTIVE_BACKUP_TABLES.filter((table) => {
    const candidates = [table.name, table.model, table.modelName].map((entry) =>
      normalizeToken(entry)
    );

    return candidates.some(
      (candidate) => candidate === normalized || candidate === singular
    );
  }).map((table) => table.modelName);

  if (matches.length > 0) {
    return Array.from(new Set(matches));
  }

  if (!entityType) {
    return [];
  }

  return [entityType.charAt(0).toUpperCase() + entityType.slice(1)];
}

function sortAuditLogs(logs: AuditLog[], eventTime?: Date, action?: string) {
  if (!eventTime) {
    return logs;
  }

  const normalizedAction = action?.toLowerCase();

  return [...logs].sort((left, right) => {
    const leftExactAction = normalizedAction
      ? left.action.toLowerCase() === normalizedAction
      : false;
    const rightExactAction = normalizedAction
      ? right.action.toLowerCase() === normalizedAction
      : false;

    if (leftExactAction !== rightExactAction) {
      return leftExactAction ? -1 : 1;
    }

    const leftDistance = Math.abs(
      new Date(left.timestamp).getTime() - eventTime.getTime()
    );
    const rightDistance = Math.abs(
      new Date(right.timestamp).getTime() - eventTime.getTime()
    );

    return leftDistance - rightDistance;
  });
}

export async function queryAuditLogs(params: AuditLogQuery): Promise<AuditLog[]> {
  if (!params.entityType || !params.entityId) {
    return [];
  }

  const models = resolveAuditModels(params.entityType);
  if (models.length === 0) {
    return [];
  }

  const limit = Math.min(Math.max(params.limit ?? 10, 1), 25);
  const eventTime = params.eventTime;
  const windowMs = 10 * 60 * 1000;

  const logs = await prisma.auditLog.findMany({
    where: {
      model: { in: models },
      targetId: params.entityId,
      action: { in: [...WRITE_ACTIONS] },
      ...(eventTime
        ? {
            timestamp: {
              gte: new Date(eventTime.getTime() - windowMs),
              lte: new Date(eventTime.getTime() + windowMs),
            },
          }
        : {}),
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  return sortAuditLogs(logs, eventTime, params.action).slice(0, limit);
}