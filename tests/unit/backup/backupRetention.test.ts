import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pruneExpiredBackups } from '@/lib/backup/backupRetention';

// We need to mock getBackupDirectory to point to our temp dir and
// silence the logger. The retention function calls real fs.

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

let backupDir: string;

vi.mock('@/lib/backup-storage', () => ({
  getBackupDirectory: () => backupDir,
}));

const tempDirs: string[] = [];

function makeTempBackupRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retention-'));
  tempDirs.push(dir);
  return dir;
}

function createBackupFolder(
  root: string,
  folderName: string,
  opts: {
    strategy?: 'full' | 'differential' | 'log';
    timestamp?: string;
    baseFolder?: string | null;
  } = {}
) {
  const folderPath = path.join(root, folderName);
  fs.mkdirSync(folderPath, { recursive: true });

  const manifest = {
    timestamp: opts.timestamp ?? folderName.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3Z'),
    database: 'test',
    format: 'all',
    strategy: opts.strategy ?? 'full',
    baseFolder: opts.baseFolder ?? null,
    files: [
      { name: `backup-${folderName}.dump`, size: 100, path: `${folderName}/backup-${folderName}.dump` },
    ],
  };

  fs.writeFileSync(
    path.join(folderPath, 'MANIFEST.json'),
    JSON.stringify(manifest)
  );
  fs.writeFileSync(
    path.join(folderPath, `backup-${folderName}.dump`),
    'fake dump'
  );
}

beforeEach(() => {
  backupDir = makeTempBackupRoot();
});

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

// ---------------------------------------------------------------------------
// pruneExpiredBackups
// ---------------------------------------------------------------------------

describe('pruneExpiredBackups', () => {
  it('returns empty result for retentionDays < 1', () => {
    const result = pruneExpiredBackups(0);
    expect(result.prunedFolders).toEqual([]);
    expect(result.skippedFolders).toEqual([]);
  });

  it('returns empty result when backup directory does not exist', () => {
    backupDir = '/nonexistent/path/that/does/not/exist';
    const result = pruneExpiredBackups(7);
    expect(result.prunedFolders).toEqual([]);
  });

  it('prunes old backup folders beyond retention window', () => {
    // Create an old backup (40 days ago)
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const oldFolder = oldDate.toISOString().replace(/:/g, '-').slice(0, 19);

    // Create a recent backup (1 day ago)
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const recentFolder = recentDate
      .toISOString()
      .replace(/:/g, '-')
      .slice(0, 19);

    createBackupFolder(backupDir, recentFolder, { strategy: 'full' });
    createBackupFolder(backupDir, oldFolder, { strategy: 'differential' });

    const result = pruneExpiredBackups(30);
    expect(result.prunedFolders).toContain(oldFolder);
    expect(result.prunedFolders).not.toContain(recentFolder);
  });

  it('protects the newest full backup even if expired', () => {
    // Create two old backups: the newest full should be protected
    const oldDate1 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const oldDate2 = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000);
    const folder1 = oldDate1.toISOString().replace(/:/g, '-').slice(0, 19);
    const folder2 = oldDate2.toISOString().replace(/:/g, '-').slice(0, 19);

    createBackupFolder(backupDir, folder1, { strategy: 'full' });
    createBackupFolder(backupDir, folder2, { strategy: 'full' });

    const result = pruneExpiredBackups(30);
    // folder2 is the newest full — should be skipped/protected
    expect(result.prunedFolders).not.toContain(folder2);
    expect(result.skippedFolders).toContain(folder2);
    // folder1 (older full) should be pruned
    expect(result.prunedFolders).toContain(folder1);
  });

  it('protects base folders referenced by non-expired differentials', () => {
    // Create a recent differential that references an old base
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const baseFolder = oldDate.toISOString().replace(/:/g, '-').slice(0, 19);
    const diffFolder = recentDate
      .toISOString()
      .replace(/:/g, '-')
      .slice(0, 19);

    createBackupFolder(backupDir, baseFolder, { strategy: 'full' });
    createBackupFolder(backupDir, diffFolder, {
      strategy: 'differential',
      baseFolder,
    });

    const result = pruneExpiredBackups(30);
    // base folder should still be protected because a non-expired diff references it
    expect(result.prunedFolders).not.toContain(baseFolder);
    expect(result.skippedFolders).toContain(baseFolder);
  });

  it('does not prune folders within the retention window', () => {
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const folder = recentDate.toISOString().replace(/:/g, '-').slice(0, 19);

    createBackupFolder(backupDir, folder, { strategy: 'full' });

    const result = pruneExpiredBackups(7);
    expect(result.prunedFolders).toEqual([]);
  });
});
