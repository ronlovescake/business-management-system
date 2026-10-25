import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getBrowseCatalog,
  getBrowseRows,
  resolveBrowseArtifacts,
} from '@/lib/backup/browseBackup';

const storage = vi.hoisted(() => ({ root: '' }));
vi.mock('@/lib/backup-storage', () => ({
  getBackupDirectory: () => storage.root,
}));
const timestamp = '2026-10-25T12-00-00-full-backup';
let folder: string;
beforeEach(() => {
  storage.root = fs.mkdtempSync(path.join(os.tmpdir(), 'browse-backup-'));
  folder = path.join(storage.root, timestamp);
  fs.mkdirSync(folder);
  fs.writeFileSync(
    path.join(folder, 'MANIFEST.json'),
    JSON.stringify({
      strategy: 'full',
      recordCounts: { customers: 501, empty: 0 },
    })
  );
  fs.writeFileSync(
    path.join(folder, `full-backup-${timestamp}.json`),
    JSON.stringify({
      tables: {
        customers: {
          data: Array.from({ length: 501 }, (_, index) => ({ id: index })),
        },
        empty: { data: [] },
      },
    })
  );
});
afterEach(() => fs.rmSync(storage.root, { recursive: true, force: true }));

describe('backup browse service', () => {
  it('never chooses summary caches as artifacts', () => {
    fs.writeFileSync(
      path.join(folder, 'full-backup-000.json.summary.json'),
      '{}'
    );
    const artifacts = resolveBrowseArtifacts(timestamp);
    expect(artifacts.json).toBe(
      path.join(folder, `full-backup-${timestamp}.json`)
    );
    expect(artifacts.files).not.toContain('full-backup-000.json.summary.json');
  });
  it('pages rows with a lookahead and handles empty tables', async () => {
    expect((await getBrowseCatalog(timestamp)).tables).toHaveLength(2);
    const first = await getBrowseRows(timestamp, 'customers', 0, 250);
    expect(first.rows).toHaveLength(250);
    expect(first.hasMore).toBe(true);
    const last = await getBrowseRows(timestamp, 'customers', 500, 250);
    expect(last.rows).toEqual([{ id: 500 }]);
    expect(last.hasMore).toBe(false);
    expect((await getBrowseRows(timestamp, 'empty', 0, 250)).rows).toEqual([]);
  });
  it('rejects unknown tables, traversal and symlink escapes', async () => {
    await expect(
      getBrowseRows(timestamp, '../../secrets', 0, 250)
    ).rejects.toMatchObject({ status: 404 });
    expect(() => resolveBrowseArtifacts('../other')).toThrow(
      'Invalid backup timestamp'
    );
    fs.unlinkSync(path.join(folder, `full-backup-${timestamp}.json`));
    fs.symlinkSync(
      '/etc/passwd',
      path.join(folder, `full-backup-${timestamp}.json`)
    );
    expect(() => resolveBrowseArtifacts(timestamp)).toThrow('Access denied');
  });
});
