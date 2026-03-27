import { logger } from '@/lib/logger';
import {
  chunkArray,
  getChangedFields,
  normalizeRecord,
  recordsMatch,
  type RowRecord,
} from './restorePreviewUtils';

type RestoreCountResult = { count: number };

export type RestoreModelDelegate = {
  findFirst: (args?: unknown) => Promise<unknown>;
  findMany: (args?: unknown) => Promise<unknown[]>;
  count: (args?: unknown) => Promise<number>;
  createMany: (args: {
    data: RowRecord[];
    skipDuplicates: boolean;
  }) => Promise<RestoreCountResult>;
  update: (args: {
    where: { id: number | string };
    data: RowRecord;
  }) => Promise<unknown>;
  deleteMany: (args?: unknown) => Promise<unknown>;
  updateMany: (args: {
    where: { id: { in: Array<number | string> } };
    data: { deletedAt: null };
  }) => Promise<RestoreCountResult>;
};

export type PreviewChange = {
  id: number | string | null;
  changes: Record<string, { before: unknown; after: unknown }>;
  incoming: RowRecord;
  existing?: RowRecord;
};

export type PreviewTableResult = {
  attempted: number;
  insertCount?: number;
  inserts: RowRecord[];
  truncatedInserts?: boolean;
  updateCount?: number;
  updates: PreviewChange[];
  truncatedUpdates?: boolean;
  skipped: number;
  notice?: string;
  deletedCount?: number;
};

const PREVIEW_SAMPLE_LIMIT = 200;
const FIND_MANY_CHUNK_SIZE = 2000;
const CREATE_MANY_CHUNK_SIZE = 1000;

export const getModelDelegate = (
  source: unknown,
  modelName: string
): RestoreModelDelegate => {
  const sourceRecord = source as Record<string, unknown>;
  const delegate = sourceRecord[modelName] as Partial<RestoreModelDelegate>;

  if (!delegate || typeof delegate !== 'object') {
    throw new Error(`Invalid model delegate for: ${modelName}`);
  }

  return delegate as RestoreModelDelegate;
};

export const ensureModelSupportsDeletedAt = async (
  modelDelegate: RestoreModelDelegate,
  tableName: string
) => {
  try {
    await modelDelegate.findFirst({ select: { deletedAt: true } });
    return { ok: true } as const;
  } catch (error) {
    logger.warn('Soft-delete restore requested for unsupported table', {
      tableName,
      error,
    });
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Table does not support deletedAt',
    } as const;
  }
};

const fetchExistingByIds = async (
  modelDelegate: RestoreModelDelegate,
  ids: Array<number | string>
): Promise<Map<number | string, RowRecord>> => {
  const map = new Map<number | string, RowRecord>();
  const uniqueIds = Array.from(new Set(ids));

  for (const chunk of chunkArray(uniqueIds, FIND_MANY_CHUNK_SIZE)) {
    if (!chunk.length) {
      continue;
    }

    const rows = await modelDelegate.findMany({
      where: { id: { in: chunk } },
    });

    for (const row of rows) {
      if (!row || typeof row !== 'object') {
        continue;
      }
      const typedRow = row as RowRecord;
      const id = typedRow.id as number | string | undefined;
      if (id !== undefined && id !== null) {
        map.set(id, typedRow);
      }
    }
  }

  return map;
};

export const processTablePreview = async (
  modelDelegate: RestoreModelDelegate,
  tableData: { data: RowRecord[] },
  forceOverwrite: boolean
): Promise<PreviewTableResult> => {
  if (forceOverwrite) {
    const beforeCount = await modelDelegate.count();
    const sample = tableData.data
      .slice(0, PREVIEW_SAMPLE_LIMIT)
      .map((row) => normalizeRecord(row));
    const insertCount = tableData.data.length;
    return {
      attempted: insertCount,
      insertCount,
      inserts: sample,
      truncatedInserts: insertCount > PREVIEW_SAMPLE_LIMIT,
      updateCount: 0,
      updates: [],
      truncatedUpdates: false,
      skipped: 0,
      notice:
        'Force overwrite is enabled. Existing records will be deleted before applying this backup.',
      deletedCount: beforeCount,
    };
  }

  const preview: PreviewTableResult = {
    attempted: tableData.data.length,
    insertCount: 0,
    inserts: [],
    truncatedInserts: false,
    updateCount: 0,
    updates: [],
    truncatedUpdates: false,
    skipped: 0,
  };

  const ids: Array<number | string> = [];
  const normalizedIncoming: RowRecord[] = [];
  for (const rawRecord of tableData.data as RowRecord[]) {
    const record = normalizeRecord(rawRecord);
    normalizedIncoming.push(record);
    const recordId = record.id as number | string | null | undefined;
    if (recordId !== null && recordId !== undefined) {
      ids.push(recordId);
    }
  }

  const existingById = ids.length
    ? await fetchExistingByIds(modelDelegate, ids)
    : new Map<number | string, RowRecord>();

  for (const record of normalizedIncoming) {
    const recordId = record.id as number | string | null | undefined;

    if (recordId === null || recordId === undefined) {
      preview.insertCount = (preview.insertCount ?? 0) + 1;
      if (preview.inserts.length < PREVIEW_SAMPLE_LIMIT) {
        preview.inserts.push(record);
      } else {
        preview.truncatedInserts = true;
      }
      continue;
    }

    const existing = existingById.get(recordId);

    if (!existing) {
      preview.insertCount = (preview.insertCount ?? 0) + 1;
      if (preview.inserts.length < PREVIEW_SAMPLE_LIMIT) {
        preview.inserts.push(record);
      } else {
        preview.truncatedInserts = true;
      }
      continue;
    }

    const normalizedExisting = normalizeRecord(existing as RowRecord);

    if (recordsMatch(normalizedExisting, record)) {
      preview.skipped++;
      continue;
    }

    preview.updateCount = (preview.updateCount ?? 0) + 1;
    if (preview.updates.length < PREVIEW_SAMPLE_LIMIT) {
      preview.updates.push({
        id: recordId,
        changes: getChangedFields(normalizedExisting, record),
        incoming: record,
        existing: normalizedExisting,
      });
    } else {
      preview.truncatedUpdates = true;
    }
  }

  return preview;
};

export const processTableRestore = async (
  modelDelegate: RestoreModelDelegate,
  tableData: { data: RowRecord[] },
  forceOverwrite: boolean
) => {
  const beforeCount = await modelDelegate.count();

  if (forceOverwrite) {
    await modelDelegate.deleteMany({});
    let createdTotal = 0;
    for (const chunk of chunkArray(tableData.data, CREATE_MANY_CHUNK_SIZE)) {
      if (!chunk.length) {
        continue;
      }
      const createdResult = await modelDelegate.createMany({
        data: chunk,
        skipDuplicates: false,
      });
      createdTotal += createdResult.count;
    }
    const afterCount = await modelDelegate.count();

    return {
      count: createdTotal,
      updated: 0,
      beforeCount,
      afterCount,
      attempted: tableData.data.length,
      skipped: 0,
    };
  }

  let created = 0;
  for (const chunk of chunkArray(tableData.data, CREATE_MANY_CHUNK_SIZE)) {
    if (!chunk.length) {
      continue;
    }
    const createdResult = await modelDelegate.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    created += createdResult.count;
  }

  const rowsWithId: Array<{ id: number | string; incoming: RowRecord }> = [];
  const ids: Array<number | string> = [];
  for (const rawRecord of tableData.data as RowRecord[]) {
    const record = rawRecord as RowRecord;
    const recordId = record.id as number | string | null | undefined;
    if (recordId === null || recordId === undefined) {
      continue;
    }
    ids.push(recordId);
    rowsWithId.push({ id: recordId, incoming: record });
  }

  const existingById = ids.length
    ? await fetchExistingByIds(modelDelegate, ids)
    : new Map<number | string, RowRecord>();

  let updated = 0;

  for (const row of rowsWithId) {
    const existing = existingById.get(row.id);
    if (!existing) {
      continue;
    }

    const incomingNormalized = normalizeRecord(row.incoming);
    const existingNormalized = normalizeRecord(existing);

    if (recordsMatch(existingNormalized, incomingNormalized)) {
      continue;
    }

    const dataToUpdate = { ...(row.incoming as RowRecord) };
    delete dataToUpdate.id;
    delete dataToUpdate.updatedAt;

    await modelDelegate.update({
      where: { id: row.id },
      data: dataToUpdate,
    });
    updated++;
  }

  const afterCount = await modelDelegate.count();

  return {
    count: created,
    updated,
    beforeCount,
    afterCount,
    attempted: tableData.data.length,
    skipped: Math.max(0, tableData.data.length - created - updated),
  };
};
