import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  writeFileAtomic,
  buildFileChecksums,
  verifyFileChecksums,
  parseBooleanFlag,
  isStrictMissingTablesEnabled,
} from '@/app/api/backup/backupRouteFileOps';

const tempDirs: string[] = [];

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-file-ops-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// writeFileAtomic
// ---------------------------------------------------------------------------

describe('writeFileAtomic', () => {
  it('writes a string atomically (no leftover .tmp file)', async () => {
    const dir = tempDir();
    const target = path.join(dir, 'output.txt');
    await writeFileAtomic(target, 'hello world');

    expect(fs.readFileSync(target, 'utf8')).toBe('hello world');
    // temp file should have been renamed away
    const files = fs.readdirSync(dir);
    expect(files).toEqual(['output.txt']);
  });

  it('writes a Buffer atomically', async () => {
    const dir = tempDir();
    const target = path.join(dir, 'output.bin');
    const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    await writeFileAtomic(target, buf);
    expect(fs.readFileSync(target)).toEqual(buf);
  });
});

// ---------------------------------------------------------------------------
// buildFileChecksums / verifyFileChecksums
// ---------------------------------------------------------------------------

describe('buildFileChecksums', () => {
  it('computes SHA-256 checksums keyed by basename', async () => {
    const dir = tempDir();
    const f1 = path.join(dir, 'a.txt');
    const f2 = path.join(dir, 'b.txt');
    fs.writeFileSync(f1, 'alpha');
    fs.writeFileSync(f2, 'bravo');

    const result = await buildFileChecksums([f1, f2]);
    expect(result['a.txt']).toMatch(/^[0-9a-f]{64}$/);
    expect(result['b.txt']).toMatch(/^[0-9a-f]{64}$/);
    expect(result['a.txt']).not.toBe(result['b.txt']);
  });
});

describe('verifyFileChecksums', () => {
  it('returns true when all checksums match', async () => {
    const dir = tempDir();
    const f = path.join(dir, 'data.txt');
    fs.writeFileSync(f, 'consistent');

    const checksums = await buildFileChecksums([f]);
    expect(await verifyFileChecksums([f], checksums)).toBe(true);
  });

  it('returns false when a checksum mismatches', async () => {
    const dir = tempDir();
    const f = path.join(dir, 'data.txt');
    fs.writeFileSync(f, 'original');

    const checksums = await buildFileChecksums([f]);
    fs.writeFileSync(f, 'tampered');
    expect(await verifyFileChecksums([f], checksums)).toBe(false);
  });

  it('returns false when expected checksum is missing', async () => {
    const dir = tempDir();
    const f = path.join(dir, 'data.txt');
    fs.writeFileSync(f, 'something');

    expect(await verifyFileChecksums([f], {})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseBooleanFlag
// ---------------------------------------------------------------------------

describe('parseBooleanFlag', () => {
  it.each([
    ['1', true],
    ['true', true],
    ['TRUE', true],
    ['yes', true],
    ['YES', true],
    ['0', false],
    ['false', false],
    ['no', false],
    ['', false],
    [undefined, false],
  ])('parseBooleanFlag(%j) => %s', (input, expected) => {
    expect(parseBooleanFlag(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// isStrictMissingTablesEnabled
// ---------------------------------------------------------------------------

describe('isStrictMissingTablesEnabled', () => {
  it('returns false when BACKUP_STRICT_TABLES is unset', () => {
    delete process.env.BACKUP_STRICT_TABLES;
    expect(isStrictMissingTablesEnabled()).toBe(false);
  });

  it('returns true when BACKUP_STRICT_TABLES is "1"', () => {
    process.env.BACKUP_STRICT_TABLES = '1';
    expect(isStrictMissingTablesEnabled()).toBe(true);
  });
});
