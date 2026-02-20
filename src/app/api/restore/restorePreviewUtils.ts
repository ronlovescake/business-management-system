import { isDeepStrictEqual } from 'util';

export type RowRecord = Record<string, unknown>;

export const FIELDS_TO_IGNORE_IN_COMPARISON = new Set(['id', 'updatedAt']);

export const chunkArray = <T>(items: T[], chunkSize: number) => {
  if (chunkSize <= 0) {
    return [items];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const normalizeValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (typeof value === 'object') {
    const serializable = value as { toJSON?: () => unknown };
    if (typeof serializable.toJSON === 'function') {
      return serializable.toJSON();
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        normalizeValue(val),
      ])
    );
  }

  return value;
};

export const normalizeRecord = (record: RowRecord): RowRecord =>
  Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, normalizeValue(value)])
  );

export const recordsMatch = (
  existing: RowRecord,
  incoming: RowRecord,
  ignoreFields = FIELDS_TO_IGNORE_IN_COMPARISON
) => {
  const keysToCompare = Object.keys(incoming).filter(
    (key) => !ignoreFields.has(key)
  );

  const existingSubset = Object.fromEntries(
    keysToCompare.map((key) => [key, existing[key]])
  );
  const incomingSubset = Object.fromEntries(
    keysToCompare.map((key) => [key, incoming[key]])
  );

  return isDeepStrictEqual(
    normalizeRecord(existingSubset),
    normalizeRecord(incomingSubset)
  );
};

export const getChangedFields = (
  existing: RowRecord,
  incoming: RowRecord,
  ignoreFields = FIELDS_TO_IGNORE_IN_COMPARISON
) => {
  const keysToCompare = Object.keys(incoming).filter(
    (key) => !ignoreFields.has(key)
  );

  return Object.fromEntries(
    keysToCompare
      .map((key) => {
        if (
          isDeepStrictEqual(existing[key], incoming[key]) ||
          (existing[key] === undefined && incoming[key] === undefined)
        ) {
          return null;
        }
        return [
          key,
          {
            before: existing[key] ?? null,
            after: incoming[key] ?? null,
          },
        ];
      })
      .filter(Boolean) as Array<[string, { before: unknown; after: unknown }]>
  );
};
