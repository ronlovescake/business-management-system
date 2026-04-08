import { describe, expect, it } from 'vitest';

import {
  chunkArray,
  normalizeRecord,
  recordsMatch,
  getChangedFields,
  FIELDS_TO_IGNORE_IN_COMPARISON,
} from '@/app/api/restore/restorePreviewUtils';

// ---------------------------------------------------------------------------
// chunkArray
// ---------------------------------------------------------------------------

describe('chunkArray', () => {
  it('splits an array into equal chunks', () => {
    expect(chunkArray([1, 2, 3, 4, 5, 6], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it('handles a last chunk smaller than chunkSize', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 3)).toEqual([
      [1, 2, 3],
      [4, 5],
    ]);
  });

  it('returns the whole array when chunkSize >= length', () => {
    expect(chunkArray([1, 2], 10)).toEqual([[1, 2]]);
  });

  it('returns the whole array wrapped when chunkSize <= 0', () => {
    expect(chunkArray([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
    expect(chunkArray([1, 2, 3], -1)).toEqual([[1, 2, 3]]);
  });

  it('returns empty outer array for empty input', () => {
    expect(chunkArray([], 5)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// normalizeRecord
// ---------------------------------------------------------------------------

describe('normalizeRecord', () => {
  it('converts Date values to ISO strings', () => {
    const date = new Date('2026-01-15T12:00:00.000Z');
    expect(normalizeRecord({ date })).toEqual({
      date: '2026-01-15T12:00:00.000Z',
    });
  });

  it('converts BigInt to string', () => {
    expect(normalizeRecord({ val: BigInt(42) })).toEqual({ val: '42' });
  });

  it('converts null and undefined to null', () => {
    expect(normalizeRecord({ a: null, b: undefined })).toEqual({
      a: null,
      b: null,
    });
  });

  it('leaves primitives unchanged', () => {
    expect(normalizeRecord({ n: 42, s: 'hello', b: true })).toEqual({
      n: 42,
      s: 'hello',
      b: true,
    });
  });

  it('normalizes nested arrays', () => {
    const result = normalizeRecord({
      items: [new Date('2026-01-01T00:00:00.000Z'), null],
    });
    expect(result).toEqual({ items: ['2026-01-01T00:00:00.000Z', null] });
  });

  it('normalizes nested objects', () => {
    const result = normalizeRecord({ nested: { a: BigInt(1) } });
    expect(result).toEqual({ nested: { a: '1' } });
  });

  it('calls toJSON when present', () => {
    const record = {
      custom: { toJSON: () => 'serialized' },
    };
    expect(normalizeRecord(record)).toEqual({ custom: 'serialized' });
  });
});

// ---------------------------------------------------------------------------
// recordsMatch
// ---------------------------------------------------------------------------

describe('recordsMatch', () => {
  it('returns true for identical records (ignoring id and updatedAt)', () => {
    const existing = { id: 1, name: 'Foo', updatedAt: '2025-01-01' };
    const incoming = { id: 2, name: 'Foo', updatedAt: '2026-01-01' };
    expect(recordsMatch(existing, incoming)).toBe(true);
  });

  it('returns false when a compared field differs', () => {
    const existing = { id: 1, name: 'Foo', status: 'active' };
    const incoming = { id: 2, name: 'Foo', status: 'inactive' };
    expect(recordsMatch(existing, incoming)).toBe(false);
  });

  it('compares only incoming keys', () => {
    const existing = { id: 1, name: 'Foo', extra: 'field' };
    const incoming = { id: 2, name: 'Foo' };
    expect(recordsMatch(existing, incoming)).toBe(true);
  });

  it('respects custom ignoreFields', () => {
    const existing = { name: 'A', version: 1 };
    const incoming = { name: 'A', version: 2 };
    expect(recordsMatch(existing, incoming, new Set(['version']))).toBe(true);
  });

  it('default ignore set contains id and updatedAt', () => {
    expect(FIELDS_TO_IGNORE_IN_COMPARISON.has('id')).toBe(true);
    expect(FIELDS_TO_IGNORE_IN_COMPARISON.has('updatedAt')).toBe(true);
  });

  it('handles Date normalization in comparison', () => {
    const existing = { id: 1, createdAt: new Date('2026-01-01T00:00:00.000Z') };
    const incoming = { id: 2, createdAt: new Date('2026-01-01T00:00:00.000Z') };
    expect(recordsMatch(existing, incoming)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getChangedFields
// ---------------------------------------------------------------------------

describe('getChangedFields', () => {
  it('returns empty object when nothing changed', () => {
    const existing = { id: 1, name: 'Foo' };
    const incoming = { id: 2, name: 'Foo' };
    expect(getChangedFields(existing, incoming)).toEqual({});
  });

  it('returns before/after for changed fields', () => {
    const existing = { id: 1, name: 'Foo', status: 'active' };
    const incoming = { id: 2, name: 'Foo', status: 'inactive' };
    expect(getChangedFields(existing, incoming)).toEqual({
      status: { before: 'active', after: 'inactive' },
    });
  });

  it('ignores id and updatedAt by default', () => {
    const existing = { id: 1, updatedAt: 'old', name: 'same' };
    const incoming = { id: 99, updatedAt: 'new', name: 'same' };
    expect(getChangedFields(existing, incoming)).toEqual({});
  });

  it('treats missing existing field as null', () => {
    const existing = { id: 1 } as Record<string, unknown>;
    const incoming = { id: 2, newField: 'value' };
    expect(getChangedFields(existing, incoming)).toEqual({
      newField: { before: null, after: 'value' },
    });
  });

  it('respects custom ignoreFields', () => {
    const existing = { name: 'A', priority: 'low' };
    const incoming = { name: 'B', priority: 'high' };
    const result = getChangedFields(existing, incoming, new Set(['priority']));
    expect(result).toEqual({
      name: { before: 'A', after: 'B' },
    });
  });
});
