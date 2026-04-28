import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';

const { mockGetDatabaseUrl, mockLogger, mockPrisma, mockSpawn } = vi.hoisted(
  () => ({
    mockGetDatabaseUrl: vi
      .fn()
      .mockReturnValue(
        'postgresql://test_user:test_pass@localhost:5432/test_db'
      ),
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    mockPrisma: {
      $queryRawUnsafe: vi.fn(),
    },
    mockSpawn: vi.fn(),
  })
);

vi.mock('@/lib/env', () => ({
  getDatabaseUrl: mockGetDatabaseUrl,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('child_process', () => ({
  __esModule: true,
  spawn: mockSpawn,
  default: {
    spawn: mockSpawn,
  },
}));

import {
  createPitrBaseBackup,
  getPitrStatus,
  pruneExpiredPitrArtifacts,
  runScheduledPitrBaseBackup,
} from '@/lib/backup/pitr';

describe('PITR helpers', () => {
  let backupRoot = '';

  beforeEach(() => {
    vi.clearAllMocks();
    backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bms-pitr-'));
    process.env.BACKUP_DIR = backupRoot;
    process.env.PITR_ENABLED = 'true';
    process.env.PITR_BASE_AUTO_ENABLED = 'true';
    process.env.PITR_BASE_AUTO_TIME = '01:00';
    process.env.BACKUP_AUTO_TIMEZONE = 'Asia/Manila';
    process.env.PITR_BASE_BACKUP_RETENTION_DAYS = '90';
    process.env.WAL_ARCHIVE_RETENTION_DAYS = '90';

    mockPrisma.$queryRawUnsafe.mockImplementation(async (query: string) => {
      if (query === 'SHOW archive_mode') {
        return [{ archive_mode: 'on' }];
      }

      if (query === 'SHOW archive_command') {
        return [
          { archive_command: '/bin/sh /usr/local/bin/archive-wal.sh %p %f' },
        ];
      }

      if (query === 'SHOW archive_timeout') {
        return [{ archive_timeout: '300s' }];
      }

      if (query === 'SHOW wal_level') {
        return [{ wal_level: 'replica' }];
      }

      if (query.includes('FROM pg_stat_archiver')) {
        return [
          {
            archived_count: BigInt(12),
            failed_count: BigInt(0),
            last_archived_wal: '00000001000000000000000A',
            last_archived_time: '2026-04-04T02:15:00.000Z',
            last_failed_wal: null,
            last_failed_time: null,
            stats_reset: '2026-04-04T00:00:00.000Z',
          },
        ];
      }

      return [];
    });

    mockSpawn.mockImplementation((_command: string, args: string[]) => {
      const processEmitter = new EventEmitter();
      const stderrEmitter = new EventEmitter();
      const destinationIndex = args.indexOf('-D');
      const destinationDir =
        destinationIndex >= 0 ? args[destinationIndex + 1] : null;

      if (!destinationDir) {
        throw new Error('Missing pg_basebackup destination directory');
      }

      fs.mkdirSync(path.join(destinationDir, 'pg_wal'), { recursive: true });
      fs.writeFileSync(path.join(destinationDir, 'PG_VERSION'), '16');
      fs.writeFileSync(path.join(destinationDir, 'backup_label'), 'LABEL');

      process.nextTick(() => {
        processEmitter.emit('close', 0);
      });

      return {
        stderr: {
          on: stderrEmitter.on.bind(stderrEmitter),
        },
        on: processEmitter.on.bind(processEmitter),
      };
    });
  });

  afterEach(() => {
    delete process.env.BACKUP_DIR;
    delete process.env.PITR_ENABLED;
    delete process.env.PITR_BASE_AUTO_ENABLED;
    delete process.env.PITR_BASE_AUTO_TIME;
    delete process.env.BACKUP_AUTO_TIMEZONE;
    delete process.env.PITR_BASE_BACKUP_RETENTION_DAYS;
    delete process.env.WAL_ARCHIVE_RETENTION_DAYS;

    if (backupRoot) {
      fs.rmSync(backupRoot, { recursive: true, force: true });
    }
  });

  it('reports PITR runtime and filesystem status', async () => {
    const baseBackupDir = path.join(
      backupRoot,
      'pitr',
      'base',
      '2026-04-04T02-00-00'
    );
    const walDir = path.join(backupRoot, 'pitr', 'wal');

    fs.mkdirSync(baseBackupDir, { recursive: true });
    fs.mkdirSync(walDir, { recursive: true });
    fs.writeFileSync(path.join(baseBackupDir, 'PG_VERSION'), '16');
    fs.writeFileSync(path.join(walDir, '00000001000000000000000A'), 'WAL');
    fs.writeFileSync(
      path.join(baseBackupDir, 'MANIFEST.json'),
      JSON.stringify(
        {
          folder: '2026-04-04T02-00-00',
          timestamp: '2026-04-04T02:00:00.000Z',
          createdAt: '2026-04-04T02:00:30.000Z',
          database: 'test_db',
          host: 'localhost',
          port: '5432',
          label: 'pitr-base-2026-04-04T02-00-00',
          totalSize: 2,
          files: [
            {
              name: 'PG_VERSION',
              path: 'pitr/base/2026-04-04T02-00-00/PG_VERSION',
              size: 2,
            },
          ],
        },
        null,
        2
      )
    );

    const status = await getPitrStatus();

    expect(status.enabled).toBe(true);
    expect(status.baseBackupCount).toBe(1);
    expect(status.latestBaseBackup?.folder).toBe('2026-04-04T02-00-00');
    expect(status.runtime.archiveMode).toBe('on');
    expect(status.runtime.walLevel).toBe('replica');
    expect(status.latestArchivedWalFile).toBe('00000001000000000000000A');
    expect(status.restoreCommandPreview).toContain('docker:restore:pitr');
  });

  it('creates a physical base backup manifest', async () => {
    const manifest = await createPitrBaseBackup();
    const baseBackupDir = path.join(
      backupRoot,
      'pitr',
      'base',
      manifest.folder
    );
    const storedManifest = JSON.parse(
      fs.readFileSync(path.join(baseBackupDir, 'MANIFEST.json'), 'utf8')
    );

    expect(mockSpawn).toHaveBeenCalledWith(
      'pg_basebackup',
      expect.arrayContaining(['-D', expect.any(String), '-Fp', '-X', 'stream']),
      expect.objectContaining({
        env: expect.objectContaining({
          PGPASSWORD: 'test_pass',
        }),
      })
    );
    expect(storedManifest.database).toBe('test_db');
    expect(storedManifest.totalSize).toBeGreaterThan(0);
    expect(storedManifest.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'PG_VERSION',
        }),
      ])
    );
  });

  it('runs a scheduled PITR base backup with scheduler metadata', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-04T04:30:00.000Z'));

    try {
      const result = await runScheduledPitrBaseBackup({
        scheduleTime: '01:00',
        timeZone: 'Asia/Manila',
      });

      expect(result.success).toBe(true);
      expect(result.skipped).toBeUndefined();
      expect(result.baseBackup?.scheduler).toMatchObject({
        trigger: 'scheduled',
        scheduleTime: '01:00',
        timeZone: 'Asia/Manila',
      });
      expect(result.prune).toMatchObject({
        baseBackupRetentionDays: 90,
        walRetentionDays: 90,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips a scheduled PITR base backup when one already exists for today', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-04T04:30:00.000Z'));

    const baseBackupDir = path.join(
      backupRoot,
      'pitr',
      'base',
      '2026-04-04T02-00-00'
    );

    fs.mkdirSync(baseBackupDir, { recursive: true });
    fs.writeFileSync(path.join(baseBackupDir, 'PG_VERSION'), '16');
    fs.writeFileSync(
      path.join(baseBackupDir, 'MANIFEST.json'),
      JSON.stringify(
        {
          folder: '2026-04-04T02-00-00',
          timestamp: '2026-04-04T02:00:00.000Z',
          createdAt: '2026-04-04T02:00:30.000Z',
          database: 'test_db',
          host: 'localhost',
          port: '5432',
          label: 'pitr-base-2026-04-04T02-00-00',
          totalSize: 2,
          files: [],
          scheduler: {
            trigger: 'scheduled',
            triggeredAt: '2026-04-04T02:00:30.000Z',
            scheduleTime: '01:00',
            timeZone: 'Asia/Manila',
            scheduledDateKey: '2026-04-04',
          },
        },
        null,
        2
      )
    );

    try {
      const result = await runScheduledPitrBaseBackup({
        scheduleTime: '01:00',
        timeZone: 'Asia/Manila',
      });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain(
        'already exists for the current scheduled day'
      );
      expect(result.prune).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('prunes expired PITR base backups and WAL files while preserving the anchor base backup', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-28T04:30:00.000Z'));
    process.env.PITR_BASE_BACKUP_RETENTION_DAYS = '7';
    process.env.WAL_ARCHIVE_RETENTION_DAYS = '7';

    const baseRoot = path.join(backupRoot, 'pitr', 'base');
    const walRoot = path.join(backupRoot, 'pitr', 'wal');
    fs.mkdirSync(baseRoot, { recursive: true });
    fs.mkdirSync(walRoot, { recursive: true });

    const writeBaseManifest = (folder: string, timestamp: string) => {
      const dir = path.join(baseRoot, folder);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'PG_VERSION'), '16');
      fs.writeFileSync(
        path.join(dir, 'MANIFEST.json'),
        JSON.stringify(
          {
            folder,
            timestamp,
            createdAt: timestamp,
            database: 'test_db',
            host: 'localhost',
            port: '5432',
            label: `pitr-base-${folder}`,
            totalSize: 2,
            files: [],
          },
          null,
          2
        )
      );
    };

    writeBaseManifest('2026-04-20T01-00-00', '2026-04-20T01:00:00.000Z');
    writeBaseManifest('2026-04-21T01-00-00', '2026-04-21T01:00:00.000Z');
    writeBaseManifest('2026-04-22T01-00-00', '2026-04-22T01:00:00.000Z');

    const oldWal = path.join(walRoot, '000000010000000000000001');
    const keptWal = path.join(walRoot, '000000010000000000000002');
    fs.writeFileSync(oldWal, 'old');
    fs.writeFileSync(keptWal, 'new');
    fs.utimesSync(
      oldWal,
      new Date('2026-04-20T00:00:00.000Z'),
      new Date('2026-04-20T00:00:00.000Z')
    );
    fs.utimesSync(
      keptWal,
      new Date('2026-04-21T02:00:00.000Z'),
      new Date('2026-04-21T02:00:00.000Z')
    );

    try {
      const result = pruneExpiredPitrArtifacts(
        new Date('2026-04-28T04:30:00.000Z')
      );

      expect(result.anchorBaseBackupFolder).toBe('2026-04-21T01-00-00');
      expect(result.prunedBaseBackupFolders).toEqual(['2026-04-20T01-00-00']);
      expect(result.prunedWalFileCount).toBe(1);
      expect(fs.existsSync(path.join(baseRoot, '2026-04-20T01-00-00'))).toBe(
        false
      );
      expect(fs.existsSync(path.join(baseRoot, '2026-04-21T01-00-00'))).toBe(
        true
      );
      expect(fs.existsSync(keptWal)).toBe(true);
      expect(fs.existsSync(oldWal)).toBe(false);
      expect(result.effectiveWalCutoff).toBe('2026-04-21T01:00:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });
});
