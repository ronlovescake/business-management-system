import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  resolveFullDumpRestoreTarget,
  writeRestoreJobStatus,
  writeRestoreRunnerHeartbeat,
} from '@/lib/backup/restoreJobState';

const tempDirs: string[] = [];

function createTempBackupDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-job-state-'));
  tempDirs.push(dir);
  return dir;
}

function writeBackupFixture({
  backupRoot,
  folder,
  strategy = 'full',
  format = 'all',
  includeDump = true,
}: {
  backupRoot: string;
  folder: string;
  strategy?: 'full' | 'differential' | 'log';
  format?: string;
  includeDump?: boolean;
}) {
  const folderPath = path.join(backupRoot, folder);
  fs.mkdirSync(folderPath, { recursive: true });

  const files = [
    {
      name: `backup-${folder}.json`,
      size: 100,
      path: `${folder}/backup-${folder}.json`,
    },
  ];

  fs.writeFileSync(path.join(folderPath, `backup-${folder}.json`), '{}');

  if (includeDump) {
    files.push({
      name: `backup-${folder}.dump`,
      size: 200,
      path: `${folder}/backup-${folder}.dump`,
    });
    fs.writeFileSync(path.join(folderPath, `backup-${folder}.dump`), 'PGDMP');
  }

  fs.writeFileSync(
    path.join(folderPath, 'MANIFEST.json'),
    JSON.stringify({
      timestamp: '2026-04-04T04:14:13.952Z',
      database: 'business_management',
      format,
      strategy,
      files,
    })
  );
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const target = tempDirs.pop();
    if (target) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

describe('resolveFullDumpRestoreTarget', () => {
  it('accepts a full backup with format all when a dump artifact is present', () => {
    const backupRoot = createTempBackupDir();
    writeBackupFixture({
      backupRoot,
      folder: '2026-04-04T04-14-13',
      strategy: 'full',
      format: 'all',
      includeDump: true,
    });

    const result = resolveFullDumpRestoreTarget(
      '2026-04-04T04-14-13',
      backupRoot
    );

    expect(result.dumpFileName).toBe('backup-2026-04-04T04-14-13.dump');
    expect(result.manifest.format).toBe('all');
  });

  it('rejects non-full backup strategies even if a dump artifact exists', () => {
    const backupRoot = createTempBackupDir();
    writeBackupFixture({
      backupRoot,
      folder: '2026-04-04T05-00-00',
      strategy: 'differential',
      format: 'dump',
      includeDump: true,
    });

    expect(() =>
      resolveFullDumpRestoreTarget('2026-04-04T05-00-00', backupRoot)
    ).toThrow(/Only full PostgreSQL dump backups/i);
  });

  it('rejects full backups that do not include a dump artifact', () => {
    const backupRoot = createTempBackupDir();
    writeBackupFixture({
      backupRoot,
      folder: '2026-04-04T06-00-00',
      strategy: 'full',
      format: 'all',
      includeDump: false,
    });

    expect(() =>
      resolveFullDumpRestoreTarget('2026-04-04T06-00-00', backupRoot)
    ).toThrow(/does not include a PostgreSQL dump file/i);
  });
});

describe('restore job state permissions', () => {
  it('writes shared-writable restore state files and directory', async () => {
    const backupRoot = createTempBackupDir();

    await writeRestoreJobStatus(
      {
        id: 'job-1',
        scope: 'full-dump',
        phase: 'pending',
        backupFolder: '2026-04-04T04-14-13',
        dumpArtifactPath: '2026-04-04T04-14-13/backup-2026-04-04T04-14-13.dump',
        dumpFileName: 'backup-2026-04-04T04-14-13.dump',
        manifestTimestamp: '2026-04-04T04:14:13.952Z',
        requestedAt: '2026-04-04T04:20:00.000Z',
        updatedAt: '2026-04-04T04:20:00.000Z',
      },
      backupRoot
    );

    await writeRestoreRunnerHeartbeat(
      {
        service: 'restore-runner',
        version: 1,
        updatedAt: '2026-04-04T04:20:05.000Z',
      },
      backupRoot
    );

    const jobsDirectoryPath = path.join(backupRoot, '_restore-jobs');
    const directoryMode = fs.statSync(jobsDirectoryPath).mode & 0o777;
    const statusMode =
      fs.statSync(path.join(jobsDirectoryPath, 'status.json')).mode & 0o777;
    const heartbeatMode =
      fs.statSync(path.join(jobsDirectoryPath, 'heartbeat.json')).mode & 0o777;

    expect(directoryMode).toBe(0o777);
    expect(statusMode).toBe(0o666);
    expect(heartbeatMode).toBe(0o666);
  });
});
