import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  sanitizeTimestamp,
  parseTimestampToDate,
  listBackupFoldersDescending,
  readManifest,
  findLatestBackupByStrategy,
} from '@/app/api/backup/backupRouteUtils';

const tempDirs: string[] = [];

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-utils-'));
  tempDirs.push(dir);
  return dir;
}

function writeManifest(
  root: string,
  folder: string,
  manifest: Record<string, unknown>
) {
  const folderPath = path.join(root, folder);
  fs.mkdirSync(folderPath, { recursive: true });
  fs.writeFileSync(
    path.join(folderPath, 'MANIFEST.json'),
    JSON.stringify(manifest)
  );
}

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

// ---------------------------------------------------------------------------
// sanitizeTimestamp
// ---------------------------------------------------------------------------

describe('sanitizeTimestamp', () => {
  it('converts folder-style timestamp to ISO', () => {
    expect(sanitizeTimestamp('2026-04-08T05-10-57')).toBe(
      '2026-04-08T05:10:57Z'
    );
  });

  it('returns ISO timestamps unchanged', () => {
    expect(sanitizeTimestamp('2026-04-08T05:10:57.000Z')).toBe(
      '2026-04-08T05:10:57.000Z'
    );
  });

  it('returns non-matching strings unchanged', () => {
    expect(sanitizeTimestamp('not-a-timestamp')).toBe('not-a-timestamp');
  });
});

// ---------------------------------------------------------------------------
// parseTimestampToDate
// ---------------------------------------------------------------------------

describe('parseTimestampToDate', () => {
  it('parses ISO timestamp to a Date', () => {
    const date = parseTimestampToDate('2026-04-08T05:10:57.000Z');
    expect(date).toBeInstanceOf(Date);
    expect(date!.toISOString()).toBe('2026-04-08T05:10:57.000Z');
  });

  it('parses folder-style timestamp', () => {
    const date = parseTimestampToDate('2026-04-08T05-10-57');
    expect(date).toBeInstanceOf(Date);
    expect(date!.getFullYear()).toBe(2026);
  });

  it('returns null for null/undefined', () => {
    expect(parseTimestampToDate(null)).toBeNull();
    expect(parseTimestampToDate(undefined)).toBeNull();
  });

  it('returns null for invalid timestamps', () => {
    expect(parseTimestampToDate('garbage')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listBackupFoldersDescending
// ---------------------------------------------------------------------------

describe('listBackupFoldersDescending', () => {
  it('returns timestamp-named folders in descending order', () => {
    const dir = tempDir();
    fs.mkdirSync(path.join(dir, '2026-01-01T00-00-00'));
    fs.mkdirSync(path.join(dir, '2026-03-01T00-00-00'));
    fs.mkdirSync(path.join(dir, '2026-02-01T00-00-00'));
    // Non-matching folder should be excluded
    fs.mkdirSync(path.join(dir, '_restore-jobs'));

    const result = listBackupFoldersDescending(dir);
    expect(result).toEqual([
      '2026-03-01T00-00-00',
      '2026-02-01T00-00-00',
      '2026-01-01T00-00-00',
    ]);
  });

  it('returns empty array for non-existent directory', () => {
    expect(listBackupFoldersDescending('/nonexistent')).toEqual([]);
  });

  it('ignores regular files', () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, '2026-01-01T00-00-00'), 'file not dir');
    expect(listBackupFoldersDescending(dir)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// readManifest
// ---------------------------------------------------------------------------

describe('readManifest', () => {
  it('reads and parses a valid manifest', () => {
    const dir = tempDir();
    writeManifest(dir, '2026-01-01T00-00-00', {
      timestamp: '2026-01-01T00:00:00.000Z',
      strategy: 'full',
    });

    const manifest = readManifest(dir, '2026-01-01T00-00-00');
    expect(manifest).toBeTruthy();
    expect(manifest!.strategy).toBe('full');
  });

  it('returns null when no MANIFEST.json exists', () => {
    const dir = tempDir();
    fs.mkdirSync(path.join(dir, 'empty-folder'));
    expect(readManifest(dir, 'empty-folder')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    const dir = tempDir();
    const folder = '2026-01-01T00-00-00';
    fs.mkdirSync(path.join(dir, folder));
    fs.writeFileSync(
      path.join(dir, folder, 'MANIFEST.json'),
      'not valid json{{'
    );
    expect(readManifest(dir, folder)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findLatestBackupByStrategy
// ---------------------------------------------------------------------------

describe('findLatestBackupByStrategy', () => {
  it('returns the newest backup matching the given strategy', () => {
    const dir = tempDir();
    writeManifest(dir, '2026-01-01T00-00-00', {
      timestamp: '2026-01-01T00:00:00.000Z',
      strategy: 'full',
    });
    writeManifest(dir, '2026-02-01T00-00-00', {
      timestamp: '2026-02-01T00:00:00.000Z',
      strategy: 'differential',
    });
    writeManifest(dir, '2026-03-01T00-00-00', {
      timestamp: '2026-03-01T00:00:00.000Z',
      strategy: 'full',
    });

    const result = findLatestBackupByStrategy(dir, 'full');
    expect(result).toBeTruthy();
    expect(result!.folder).toBe('2026-03-01T00-00-00');
  });

  it('returns null when no backup matches', () => {
    const dir = tempDir();
    writeManifest(dir, '2026-01-01T00-00-00', {
      timestamp: '2026-01-01T00:00:00.000Z',
      strategy: 'full',
    });

    expect(findLatestBackupByStrategy(dir, 'log')).toBeNull();
  });

  it('returns null for empty backup dir', () => {
    const dir = tempDir();
    expect(findLatestBackupByStrategy(dir, 'full')).toBeNull();
  });
});
