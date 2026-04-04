import type { ChangeLog } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export type ChangeLogAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'import'
  | 'export'
  | 'restore'
  | string;

export interface ChangeLogContext {
  userId?: string | null;
  userName?: string | null;
  source?: string | null;
  metadata?: Prisma.JsonValue;
}

export interface ChangeLogEntryInput {
  entityType: string;
  entityId?: string | number | null;
  action: ChangeLogAction;
  field?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Prisma.JsonValue;
}

export interface RecordChangeResult {
  success: boolean;
  error?: unknown;
}

function toJsonValue(
  value: unknown
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch (error) {
    logger.warn('Failed to serialize value for change log entry', {
      valueType: typeof value,
      error,
    });
    return String(value);
  }
}

function buildChangeLogData(
  entry: ChangeLogEntryInput,
  context?: ChangeLogContext
): Prisma.ChangeLogCreateInput {
  const oldValue = toJsonValue(entry.oldValue);
  const newValue = toJsonValue(entry.newValue);
  const metadata = entry.metadata ?? context?.metadata;

  return {
    entityType: entry.entityType,
    entityId: entry.entityId?.toString?.() ?? null,
    action: entry.action,
    field: entry.field ?? null,
    ...(oldValue !== undefined && { oldValue }),
    ...(newValue !== undefined && { newValue }),
    userId: context?.userId ?? null,
    userName: context?.userName ?? null,
    source: context?.source ?? null,
    ...(metadata !== undefined
      ? { metadata: metadata ?? Prisma.JsonNull }
      : {}),
  } satisfies Prisma.ChangeLogCreateInput;
}

export async function recordChange(
  entry: ChangeLogEntryInput,
  context?: ChangeLogContext
): Promise<RecordChangeResult> {
  try {
    await prisma.changeLog.create({
      data: buildChangeLogData(entry, context),
    });
    return { success: true };
  } catch (error) {
    logger.warn('Failed to record change log entry', {
      entry,
      context,
      error,
    });
    return { success: false, error };
  }
}

export async function recordChanges(
  entries: ChangeLogEntryInput[],
  context?: ChangeLogContext
): Promise<RecordChangeResult> {
  if (entries.length === 0) {
    return { success: true };
  }

  const data = entries.map((entry) => buildChangeLogData(entry, context));

  try {
    await prisma.changeLog.createMany({
      data,
    });
    return { success: true };
  } catch (error) {
    logger.warn('Failed to record batch change log entries', {
      count: entries.length,
      context,
      error,
    });

    // Fallback to individual inserts to capture as much as possible
    for (const entry of entries) {
      await recordChange(entry, context);
    }

    return { success: false, error };
  }
}

export interface ChangeLogQuery {
  page?: number;
  limit?: number;
  entityType?: string;
  entityId?: string;
  userId?: string;
  actor?: string;
  action?: string;
  source?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ChangeLogQueryResult {
  data: ChangeLog[];
  total: number;
  page: number;
  limit: number;
}

const CHANGE_LOG_IDENTIFIER_PATHS = [
  'description',
  'customerName',
  'customer',
  'customerDisplayName',
  'customer_name',
  'invoiceNumber',
  'invoiceNo',
  'invoice',
  'transactionNumber',
  'transactionNo',
  'productCode',
  'product_code',
  'sku',
  'itemCode',
  'item_code',
  'employeeName',
  'employee',
  'routeName',
  'workspace',
  'module',
  'name',
] as const;

function buildJsonPathContainsCondition(
  field: 'metadata' | 'oldValue' | 'newValue',
  path: string,
  searchTerm: string
): Prisma.ChangeLogWhereInput {
  const filter = {
    path: [path],
    string_contains: searchTerm,
  } as Prisma.JsonFilter<'ChangeLog'>;

  if (field === 'metadata') {
    return { metadata: filter };
  }

  if (field === 'oldValue') {
    return { oldValue: filter };
  }

  return { newValue: filter };
}

function buildActorWhere(actor: string): Prisma.ChangeLogWhereInput {
  const normalizedActor = actor.trim();

  return {
    OR: [
      { userId: normalizedActor },
      { userName: { contains: normalizedActor, mode: 'insensitive' } },
    ],
  };
}

function buildSearchWhere(searchTerm: string): Prisma.ChangeLogWhereInput {
  return {
    OR: [
      { userId: { contains: searchTerm, mode: 'insensitive' } },
      { userName: { contains: searchTerm, mode: 'insensitive' } },
      { entityType: { contains: searchTerm, mode: 'insensitive' } },
      { entityId: { contains: searchTerm, mode: 'insensitive' } },
      { action: { contains: searchTerm, mode: 'insensitive' } },
      { field: { contains: searchTerm, mode: 'insensitive' } },
      { source: { contains: searchTerm, mode: 'insensitive' } },
      ...CHANGE_LOG_IDENTIFIER_PATHS.flatMap((path) => [
        buildJsonPathContainsCondition('metadata', path, searchTerm),
        buildJsonPathContainsCondition('oldValue', path, searchTerm),
        buildJsonPathContainsCondition('newValue', path, searchTerm),
      ]),
    ],
  };
}

export async function queryChangeLogs(
  params: ChangeLogQuery
): Promise<ChangeLogQueryResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 25), 200);
  const skip = (page - 1) * limit;

  const andClauses: Prisma.ChangeLogWhereInput[] = [];

  if (params.actor?.trim()) {
    andClauses.push(buildActorWhere(params.actor));
  }

  const where: Prisma.ChangeLogWhereInput = {
    ...(params.entityType && { entityType: params.entityType }),
    ...(params.entityId && { entityId: params.entityId }),
    ...(params.userId && { userId: params.userId }),
    ...(params.action && { action: params.action }),
    ...(params.source && { source: params.source }),
  };

  if (params.startDate || params.endDate) {
    andClauses.push({
      createdAt: {
        ...(params.startDate && { gte: params.startDate }),
        ...(params.endDate && { lte: params.endDate }),
      },
    });
  }

  if (params.search) {
    const searchTerm = params.search.trim();
    if (searchTerm.length > 0) {
      andClauses.push(buildSearchWhere(searchTerm));
    }
  }

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  const [data, total] = await Promise.all([
    prisma.changeLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.changeLog.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    limit,
  };
}

export async function getDistinctChangeLogFilters() {
  const [entityTypes, actions, sources] = await Promise.all([
    prisma.changeLog.findMany({
      distinct: ['entityType'],
      select: { entityType: true },
      orderBy: { entityType: 'asc' },
    }) as Promise<Array<{ entityType: string | null }>>,
    prisma.changeLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    }) as Promise<Array<{ action: string | null }>>,
    prisma.changeLog.findMany({
      distinct: ['source'],
      select: { source: true },
      where: { source: { not: null } },
      orderBy: { source: 'asc' },
    }) as Promise<Array<{ source: string | null }>>,
  ]);

  return {
    entityTypes: entityTypes
      .map((item) => item.entityType)
      .filter((value): value is string => Boolean(value)),
    actions: actions
      .map((item) => item.action)
      .filter((value): value is string => Boolean(value)),
    sources: sources
      .map((item) => item.source)
      .filter((value): value is string => Boolean(value)),
  };
}
