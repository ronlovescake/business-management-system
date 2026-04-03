import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { getDatabaseUrl } from '@/lib/env';
import { logger } from '@/lib/logger';
import { getBackupDirectory } from '@/lib/backup-storage';
import {
  buildFileChecksums,
  verifyFileChecksums,
  writeFileAtomic,
} from '@/app/api/backup/backupRouteFileOps';
import {
  describeFiles,
  type BackupManifestFile,
} from '@/app/api/backup/backupRouteUtils';
import {
  buildRecordCountsFromSnapshot,
  collectRestoreVerificationSnapshot,
} from '@/lib/backup/restoreVerification';

const BACKUP_DIR = getBackupDirectory();

export type FullDumpBackupResult = {
  success: true;
  backup: {
    timestamp: string;
    files: string[];
    totalSize: number;
    format: 'dump';
    strategy: 'full';
  };
  manifest: BackupManifestFile;
};

function parseDatabaseUrl() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    throw new Error('DATABASE_URL not found');
  }

  const parsed = new URL(dbUrl);
  const database = parsed.pathname.replace(/^\//, '');

  if (!parsed.username || !database) {
    throw new Error('Invalid DATABASE_URL format');
  }

  return {
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password ?? ''),
    host: parsed.hostname,
    port: parsed.port || '5432',
    database,
  };
}

function buildBackupTimestamp(now = new Date()) {
  const manilaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return manilaTime.toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

function ensureBackupDir(timestamp: string) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestampDir = path.join(BACKUP_DIR, timestamp);
  if (!fs.existsSync(timestampDir)) {
    fs.mkdirSync(timestampDir, { recursive: true });
  }

  return timestampDir;
}

function cleanupPartialBackup(backupDir: string | null) {
  if (!backupDir) {
    return;
  }

  const resolvedRoot = path.resolve(BACKUP_DIR);
  const resolvedBackupDir = path.resolve(backupDir);

  if (
    resolvedBackupDir === resolvedRoot ||
    !resolvedBackupDir.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    logger.warn('Refusing to clean up dump backup directory outside root', {
      backupDir: resolvedBackupDir,
      backupRoot: resolvedRoot,
    });
    return;
  }

  try {
    fs.rmSync(resolvedBackupDir, { recursive: true, force: true });
  } catch (error) {
    logger.warn('Failed to clean up partial dump backup directory', {
      backupDir: resolvedBackupDir,
      error,
    });
  }
}

async function createDatabaseDump(timestamp: string, backupDir: string) {
  const { user, password, host, port, database } = parseDatabaseUrl();
  const dumpFile = path.join(backupDir, `backup-${timestamp}.dump`);

  const env = {
    ...process.env,
    ...(password ? { PGPASSWORD: password } : {}),
  };

  const args = [
    '-h',
    host,
    '-p',
    port,
    '-U',
    user,
    '-d',
    database,
    '-F',
    'c',
    '-f',
    dumpFile,
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn('pg_dump', args, { env });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `pg_dump failed with code ${code}`));
    });
  });

  if (!fs.existsSync(dumpFile)) {
    throw new Error('pg_dump completed without producing a dump file');
  }

  return { dumpFile, database };
}

export async function createFullDumpBackup() {
  let backupDirForCleanup: string | null = null;

  try {
    const timestamp = buildBackupTimestamp();
    const backupDir = ensureBackupDir(timestamp);
    backupDirForCleanup = backupDir;

    const { dumpFile, database } = await createDatabaseDump(
      timestamp,
      backupDir
    );
    const files = [dumpFile];
    const describedFiles = await describeFiles(files);
    const totalSize = describedFiles.reduce((sum, { size }) => sum + size, 0);

    const fileChecksums = await buildFileChecksums(files);
    const integrityVerified = await verifyFileChecksums(files, fileChecksums);
    if (!integrityVerified) {
      throw new Error('Dump backup integrity verification failed');
    }

    const restoreVerification = await collectRestoreVerificationSnapshot();

    const manifest: BackupManifestFile = {
      timestamp: new Date().toISOString(),
      database,
      format: 'dump',
      strategy: 'full',
      files: describedFiles.map(({ filePath, size }) => ({
        name: path.basename(filePath),
        size,
        path: path.relative(BACKUP_DIR, filePath),
        checksum: fileChecksums[path.basename(filePath)],
      })),
      integrity: {
        algorithm: 'sha256',
        verified: true,
        generatedAt: new Date().toISOString(),
        fileChecksums,
      },
      recordCounts: buildRecordCountsFromSnapshot(restoreVerification),
      restoreVerification,
    };

    await writeFileAtomic(
      path.join(backupDir, 'MANIFEST.json'),
      JSON.stringify(manifest, null, 2)
    );

    return {
      success: true,
      backup: {
        timestamp,
        files: files.map((filePath) => path.basename(filePath)),
        totalSize,
        format: 'dump',
        strategy: 'full',
      },
      manifest,
    } satisfies FullDumpBackupResult;
  } catch (error) {
    cleanupPartialBackup(backupDirForCleanup);
    throw error;
  }
}
