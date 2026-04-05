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

interface ChangeLogCountRow {
  total: number;
}

const CHANGE_LOG_IDENTIFIER_PATHS = [
  'description',
  'customers',
  'customerName',
  'customer',
  'customerDisplayName',
  'customer_name',
  'customerCode',
  'invoiceNumber',
  'invoiceNo',
  'invoice',
  'transactionNumber',
  'transactionNo',
  'productCode',
  'product_code',
  'productName',
  'product',
  'sku',
  'itemCode',
  'item_code',
  'notes',
  'shipmentCode',
  'shipment_code',
  'referenceNumber',
  'referenceNo',
  'employeeName',
  'employee',
  'routeName',
  'workspace',
  'module',
  'name',
] as const;

const CHANGE_LOG_PRIORITY_PATHS = [
  'customers',
  'customerName',
  'customer',
  'customerDisplayName',
  'customer_name',
  'customerCode',
  'invoiceNumber',
  'invoiceNo',
  'invoice',
  'transactionNumber',
  'transactionNo',
  'productCode',
  'product_code',
  'productName',
  'product',
  'sku',
  'itemCode',
  'item_code',
  'notes',
  'shipmentCode',
  'shipment_code',
  'referenceNumber',
  'referenceNo',
] as const;

const CHANGE_LOG_GENERIC_PRIORITY_COLUMNS = [
  'entityType',
  'entityId',
  'action',
  'field',
  'source',
] as const;

function buildActorWhere(actor: string): Prisma.ChangeLogWhereInput {
  const normalizedActor = actor.trim();

  return {
    OR: [
      { userId: normalizedActor },
      { userName: { contains: normalizedActor, mode: 'insensitive' } },
    ],
  };
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function buildJsonPathMatchExpressions(
  paths: readonly string[],
  pattern: string
): Prisma.Sql[] {
  return paths.flatMap((path) => [
    Prisma.sql`COALESCE(metadata ->> ${path}, '') ILIKE ${pattern} ESCAPE '\\'`,
    Prisma.sql`COALESCE("oldValue" ->> ${path}, '') ILIKE ${pattern} ESCAPE '\\'`,
    Prisma.sql`COALESCE("newValue" ->> ${path}, '') ILIKE ${pattern} ESCAPE '\\'`,
  ]);
}

function buildColumnMatchExpressions(
  columns: readonly string[],
  pattern: string
): Prisma.Sql[] {
  return columns.map(
    (column) =>
      Prisma.sql`COALESCE(${Prisma.raw(`"${column}"`)}, '') ILIKE ${pattern} ESCAPE '\\'`
  );
}

function joinSqlConditions(
  expressions: Prisma.Sql[],
  separator: ' OR ' | ' AND '
): Prisma.Sql {
  if (expressions.length === 0) {
    return Prisma.sql`FALSE`;
  }

  return Prisma.sql`(${Prisma.join(expressions, separator)})`;
}

function buildSearchSql(searchTerm: string): Prisma.Sql {
  const likePattern = `%${escapeLikePattern(searchTerm)}%`;
  const searchConditions: Prisma.Sql[] = [
    ...buildColumnMatchExpressions(CHANGE_LOG_GENERIC_PRIORITY_COLUMNS, likePattern),
    ...buildJsonPathMatchExpressions(CHANGE_LOG_IDENTIFIER_PATHS, likePattern),
  ];

  return joinSqlConditions(searchConditions, ' OR ');
}

function buildSearchRankSql(searchTerm: string): Prisma.Sql {
  const escapedTerm = escapeLikePattern(searchTerm);
  const prefixPattern = `${escapedTerm}%`;
  const containsPattern = `%${escapedTerm}%`;

  const priorityPrefixConditions = buildJsonPathMatchExpressions(
    CHANGE_LOG_PRIORITY_PATHS,
    prefixPattern
  );
  const genericPrefixConditions = buildColumnMatchExpressions(
    CHANGE_LOG_GENERIC_PRIORITY_COLUMNS,
    prefixPattern
  );
  const priorityContainsConditions = buildJsonPathMatchExpressions(
    CHANGE_LOG_PRIORITY_PATHS,
    containsPattern
  );

  return Prisma.sql`
    CASE
      WHEN ${joinSqlConditions(priorityPrefixConditions, ' OR ')} THEN 0
      WHEN ${joinSqlConditions(genericPrefixConditions, ' OR ')} THEN 1
      WHEN ${joinSqlConditions(priorityContainsConditions, ' OR ')} THEN 2
      ELSE 3
    END
  `;
}

function buildChangeLogWhereSql(params: ChangeLogQuery): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (params.entityType) {
    conditions.push(Prisma.sql`"entityType" = ${params.entityType}`);
  }

  if (params.entityId) {
    conditions.push(Prisma.sql`"entityId" = ${params.entityId}`);
  }

  if (params.userId) {
    conditions.push(Prisma.sql`"userId" = ${params.userId}`);
  }

  if (params.action) {
    conditions.push(Prisma.sql`action = ${params.action}`);
  }

  if (params.source) {
    conditions.push(Prisma.sql`source = ${params.source}`);
  }

  if (params.startDate) {
    conditions.push(Prisma.sql`"createdAt" >= ${params.startDate}`);
  }

  if (params.endDate) {
    conditions.push(Prisma.sql`"createdAt" <= ${params.endDate}`);
  }

  if (params.actor?.trim()) {
    const normalizedActor = params.actor.trim();
    const actorLikePattern = `%${escapeLikePattern(normalizedActor)}%`;

    conditions.push(
      Prisma.sql`(
        "userId" = ${normalizedActor}
        OR COALESCE("userName", '') ILIKE ${actorLikePattern} ESCAPE '\\'
      )`
    );
  }

  if (params.search?.trim()) {
    conditions.push(buildSearchSql(params.search.trim()));
  }

  if (conditions.length === 0) {
    return Prisma.sql``;
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

async function queryChangeLogsWithCaseInsensitiveSearch(
  params: ChangeLogQuery,
  page: number,
  limit: number,
  skip: number
): Promise<ChangeLogQueryResult> {
  const trimmedSearch = params.search?.trim();
  if (!trimmedSearch) {
    throw new Error('Search term is required for ranked change-log queries.');
  }

  const whereSql = buildChangeLogWhereSql(params);
  const searchRankSql = buildSearchRankSql(trimmedSearch);

  const [data, countRows] = await Promise.all([
    prisma.$queryRaw<ChangeLog[]>(Prisma.sql`
      SELECT
        id,
        "createdAt",
        "userId",
        "userName",
        "entityType",
        "entityId",
        action,
        field,
        "oldValue",
        "newValue",
        source,
        metadata
      FROM (
        SELECT
          id,
          "createdAt",
          "userId",
          "userName",
          "entityType",
          "entityId",
          action,
          field,
          "oldValue",
          "newValue",
          source,
          metadata,
          ${searchRankSql} AS search_rank
        FROM "change_log"
        ${whereSql}
      ) ranked_logs
      ORDER BY search_rank ASC, "createdAt" DESC
      OFFSET ${skip}
      LIMIT ${limit}
    `),
    prisma.$queryRaw<ChangeLogCountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM "change_log"
      ${whereSql}
    `),
  ]);

  return {
    data,
    total: countRows[0]?.total ?? 0,
    page,
    limit,
  };
}

export async function queryChangeLogs(
  params: ChangeLogQuery
): Promise<ChangeLogQueryResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 25), 200);
  const skip = (page - 1) * limit;

  if (params.search?.trim()) {
    return queryChangeLogsWithCaseInsensitiveSearch(params, page, limit, skip);
  }

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
