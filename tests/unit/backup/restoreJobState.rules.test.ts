/**
 * Backup/Restore — Rule-Mapped Tests for restoreJobState
 *
 * Rules from docs/business-logic/platform/admin-backup-restore.md:
 *   #17 — Backup folder path is bounded to the backup root (path traversal)
 *   #19 — Runner availability is freshness-based (15s default max age)
 *   #21 — Restore jobs use four phases
 *   #22 — Pending restore status is created before execution begins
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isRestoreJobActive,
  isRestoreRunnerAvailable,
  buildPendingRestoreJobStatus,
  resolveFullDumpRestoreTarget,
  type RestoreJobPhase,
  type RestoreRunnerHeartbeat,
  type FullDumpRestoreTarget,
} from '@/lib/backup/restoreJobState';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const tempDirs: string[] = [];

function tempBackupRoot() {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'restore-rule-mapped-')
  );
  tempDirs.push(dir);
  return dir;
}

function writeManifestAndDump(
  root: string,
  folder: string,
  opts: { strategy?: string; includeDump?: boolean; escapePath?: boolean } = {}
) {
  const folderPath = path.join(root, folder);
  fs.mkdirSync(folderPath, { recursive: true });

  const dumpName = `backup-${folder}.dump`;
  const dumpPath = opts.escapePath
    ? `../../etc/passwd`
    : `${folder}/${dumpName}`;

  const manifest = {
    timestamp: folder.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3Z'),
    database: 'test',
    format: 'all',
    strategy: opts.strategy ?? 'full',
    files: [{ name: dumpName, size: 100, path: dumpPath }],
  };

  fs.writeFileSync(
    path.join(folderPath, 'MANIFEST.json'),
    JSON.stringify(manifest)
  );

  if (opts.includeDump !== false && !opts.escapePath) {
    fs.writeFileSync(path.join(folderPath, dumpName), 'fake dump data');
  }
}

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

// ---------------------------------------------------------------------------
// Rule #17 — Backup folder path is bounded to the backup root
// ---------------------------------------------------------------------------

describe('Rule #17: Backup folder path is bounded to the backup root', () => {
  it('rejects dump paths that escape the backup directory', () => {
    const root = tempBackupRoot();
    const folder = '2026-04-08T05-10-57';
    writeManifestAndDump(root, folder, { escapePath: true });

    expect(() => resolveFullDumpRestoreTarget(folder, root)).toThrow(
      /escaped the backup directory/i
    );
  });

  it('accepts dump paths within the backup directory', () => {
    const root = tempBackupRoot();
    const folder = '2026-04-08T05-10-57';
    writeManifestAndDump(root, folder);

    const target = resolveFullDumpRestoreTarget(folder, root);
    expect(target.folder).toBe(folder);
    expect(target.dumpAbsolutePath).toContain(root);
  });
});

// ---------------------------------------------------------------------------
// Rule #7 — Manifest strategy must be `full` for supported DR restore
// ---------------------------------------------------------------------------

describe('Rule #7: Manifest strategy must be full', () => {
  it('rejects non-full backup strategies', () => {
    const root = tempBackupRoot();
    const folder = '2026-04-08T05-10-57';
    writeManifestAndDump(root, folder, { strategy: 'differential' });

    expect(() => resolveFullDumpRestoreTarget(folder, root)).toThrow(
      /only full/i
    );
  });
});

// ---------------------------------------------------------------------------
// Rule #6 — Only .dump files are accepted for DR restore
// ---------------------------------------------------------------------------

describe('Rule #6: Only .dump files are accepted', () => {
  it('rejects manifests without a .dump artifact', () => {
    const root = tempBackupRoot();
    const folder = '2026-04-08T05-10-57';
    const folderPath = path.join(root, folder);
    fs.mkdirSync(folderPath, { recursive: true });
    fs.writeFileSync(
      path.join(folderPath, 'MANIFEST.json'),
      JSON.stringify({
        timestamp: '2026-04-08T05:10:57Z',
        strategy: 'full',
        files: [{ name: 'data.json', size: 100, path: `${folder}/data.json` }],
      })
    );

    expect(() => resolveFullDumpRestoreTarget(folder, root)).toThrow(
      /dump file/i
    );
  });
});

// ---------------------------------------------------------------------------
// Rule #19 — Runner availability is freshness-based (default 15s max age)
// ---------------------------------------------------------------------------

describe('Rule #19: Runner availability is freshness-based', () => {
  it('treats runner as available when heartbeat is within 15s', () => {
    const heartbeat: RestoreRunnerHeartbeat = {
      service: 'restore-runner',
      version: 1,
      updatedAt: new Date(Date.now() - 5000).toISOString(), // 5s ago
    };

    expect(isRestoreRunnerAvailable(heartbeat)).toBe(true);
  });

  it('treats runner as offline when heartbeat is older than 15s', () => {
    const heartbeat: RestoreRunnerHeartbeat = {
      service: 'restore-runner',
      version: 1,
      updatedAt: new Date(Date.now() - 20000).toISOString(), // 20s ago
    };

    expect(isRestoreRunnerAvailable(heartbeat)).toBe(false);
  });

  it('treats runner as offline when heartbeat is null', () => {
    expect(isRestoreRunnerAvailable(null)).toBe(false);
  });

  it('treats runner as offline when updatedAt is invalid', () => {
    const heartbeat: RestoreRunnerHeartbeat = {
      service: 'restore-runner',
      version: 1,
      updatedAt: 'not-a-date',
    };

    expect(isRestoreRunnerAvailable(heartbeat)).toBe(false);
  });

  it('respects custom maxAgeMs parameter', () => {
    const heartbeat: RestoreRunnerHeartbeat = {
      service: 'restore-runner',
      version: 1,
      updatedAt: new Date(Date.now() - 5000).toISOString(),
    };

    expect(isRestoreRunnerAvailable(heartbeat, 3000)).toBe(false);
    expect(isRestoreRunnerAvailable(heartbeat, 10000)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rule #21 — Restore jobs use four phases
// ---------------------------------------------------------------------------

describe('Rule #21: Restore jobs use four phases', () => {
  const activePhases: RestoreJobPhase[] = ['pending', 'running'];
  const inactivePhases: RestoreJobPhase[] = ['succeeded', 'failed'];

  for (const phase of activePhases) {
    it(`phase "${phase}" is considered active`, () => {
      expect(isRestoreJobActive({ phase } as never)).toBe(true);
    });
  }

  for (const phase of inactivePhases) {
    it(`phase "${phase}" is considered inactive`, () => {
      expect(isRestoreJobActive({ phase } as never)).toBe(false);
    });
  }

  it('null status is considered inactive', () => {
    expect(isRestoreJobActive(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule #22 — Pending status is created with correct structure
// ---------------------------------------------------------------------------

describe('Rule #22: Pending restore status is created before execution', () => {
  it('buildPendingRestoreJobStatus creates a pending-phase status', () => {
    const target: FullDumpRestoreTarget = {
      folder: '2026-04-08T05-10-57',
      manifest: {
        timestamp: '2026-04-08T05:10:57.261Z',
        database: 'business_management',
        format: 'all',
        strategy: 'full',
        files: [],
      },
      dumpFileName: 'backup-2026-04-08T05-10-57.dump',
      dumpArtifactPath: '2026-04-08T05-10-57/backup-2026-04-08T05-10-57.dump',
      dumpAbsolutePath: '/backups/2026-04-08T05-10-57/backup-2026-04-08T05-10-57.dump',
    };

    const status = buildPendingRestoreJobStatus(target);

    expect(status.phase).toBe('pending');
    expect(status.scope).toBe('full-dump');
    expect(status.backupFolder).toBe('2026-04-08T05-10-57');
    expect(status.id).toBeTruthy(); // UUID generated
    expect(status.requestedAt).toBeTruthy();
  });
});
