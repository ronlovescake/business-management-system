import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import {
  BACKUP_MODEL_CLASSIFICATION,
  LOG_BACKUP_TABLES,
  SELECTIVE_BACKUP_TABLES,
  type BackupCoverageClass,
} from '@/lib/backup/backupModelRegistry';

export interface RestoreVerificationEntry {
  key: string;
  modelName: string;
  schema: string;
  table: string;
  coverage: BackupCoverageClass;
  count: number;
}

export interface RestoreVerificationSkippedEntry {
  key: string;
  modelName: string;
  schema: string;
  table: string;
  coverage: BackupCoverageClass;
  reason: 'table-missing';
}

export interface RestoreVerificationSnapshot {
  generatedAt: string;
  entries: RestoreVerificationEntry[];
  skippedEntries?: RestoreVerificationSkippedEntry[];
}

export interface RestoreVerificationComparison {
  matchedEntries: RestoreVerificationEntry[];
  mismatchedEntries: Array<{
    expected: RestoreVerificationEntry;
    actual: RestoreVerificationEntry;
  }>;
  missingEntries: RestoreVerificationEntry[];
  unexpectedEntries: RestoreVerificationEntry[];
}

type RestoreVerificationTarget = Omit<RestoreVerificationEntry, 'count'>;

export interface RestoreVerificationClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

const RECORD_COUNT_KEY_BY_MODEL_NAME = new Map<string, string>([
  ...SELECTIVE_BACKUP_TABLES.map(
    ({ modelName, name }) => [modelName, name] as [string, string]
  ),
  ...LOG_BACKUP_TABLES.map(
    ({ modelName, name }) => [modelName, name] as [string, string]
  ),
]);

function getSchemaForModelName(modelName: string) {
  return modelName.startsWith('GeneralMerchandise')
    ? 'general_merchandise'
    : 'public';
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function normalizeCount(value: unknown) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return Number(value);
  }

  return 0;
}

function buildRestoreVerificationKey(
  modelName: string,
  schema: string,
  table: string
) {
  return (
    RECORD_COUNT_KEY_BY_MODEL_NAME.get(modelName) ??
    (schema === 'public' ? table : `${schema}.${table}`)
  );
}

export function getRestoreVerificationTargets() {
  return Object.entries(BACKUP_MODEL_CLASSIFICATION)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([modelName, coverage]) => {
      const dmmfModel = Prisma.dmmf.datamodel.models.find(
        (entry) => entry.name === modelName
      );

      if (!dmmfModel) {
        throw new Error(
          `Restore verification model ${modelName} was not found in Prisma DMMF`
        );
      }

      const schema = getSchemaForModelName(modelName);
      const table = dmmfModel.dbName ?? modelName;

      return {
        key: buildRestoreVerificationKey(modelName, schema, table),
        modelName,
        schema,
        table,
        coverage,
      } satisfies RestoreVerificationTarget;
    });
}

async function doesTableExist(
  prismaClient: RestoreVerificationClient,
  schema: string,
  table: string
) {
  const relationName = `${schema}.${table}`;
  const result = await prismaClient.$queryRawUnsafe<Array<{ exists: boolean }>>(
    'SELECT to_regclass($1) IS NOT NULL AS "exists"',
    relationName
  );

  return !!result?.[0]?.exists;
}

async function countTableRows(
  prismaClient: RestoreVerificationClient,
  schema: string,
  table: string
) {
  const query = `SELECT COUNT(*)::bigint AS count FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
  const result =
    await prismaClient.$queryRawUnsafe<Array<{ count: unknown }>>(query);

  return normalizeCount(result?.[0]?.count);
}

export async function collectRestoreVerificationSnapshot(
  prismaClient: RestoreVerificationClient = prisma
) {
  const entries: RestoreVerificationEntry[] = [];
  const skippedEntries: RestoreVerificationSkippedEntry[] = [];

  for (const target of getRestoreVerificationTargets()) {
    const exists = await doesTableExist(
      prismaClient,
      target.schema,
      target.table
    );

    if (!exists) {
      skippedEntries.push({
        ...target,
        reason: 'table-missing',
      });
      continue;
    }

    entries.push({
      ...target,
      count: await countTableRows(prismaClient, target.schema, target.table),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    entries,
    skippedEntries: skippedEntries.length ? skippedEntries : undefined,
  } satisfies RestoreVerificationSnapshot;
}

export function buildRecordCountsFromSnapshot(
  snapshot?: RestoreVerificationSnapshot | null
) {
  if (!snapshot) {
    return {};
  }

  return Object.fromEntries(
    snapshot.entries.map(({ key, count }) => [key, count])
  );
}

export function compareRestoreVerificationSnapshots(
  expectedSnapshot: RestoreVerificationSnapshot,
  actualSnapshot: RestoreVerificationSnapshot
) {
  const actualByKey = new Map(
    actualSnapshot.entries.map((entry) => [entry.key, entry])
  );
  const expectedByKey = new Map(
    expectedSnapshot.entries.map((entry) => [entry.key, entry])
  );

  const matchedEntries: RestoreVerificationEntry[] = [];
  const mismatchedEntries: Array<{
    expected: RestoreVerificationEntry;
    actual: RestoreVerificationEntry;
  }> = [];
  const missingEntries: RestoreVerificationEntry[] = [];

  for (const expected of expectedSnapshot.entries) {
    const actual = actualByKey.get(expected.key);

    if (!actual) {
      missingEntries.push(expected);
      continue;
    }

    if (actual.count !== expected.count) {
      mismatchedEntries.push({ expected, actual });
      continue;
    }

    matchedEntries.push(actual);
  }

  const unexpectedEntries = actualSnapshot.entries.filter(
    (entry) => !expectedByKey.has(entry.key)
  );

  return {
    matchedEntries,
    mismatchedEntries,
    missingEntries,
    unexpectedEntries,
  } satisfies RestoreVerificationComparison;
}
