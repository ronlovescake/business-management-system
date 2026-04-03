import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

import { logger } from '@/lib/logger';
import { getBackupDirectory } from '@/lib/backup-storage';
import { writeFileAtomic } from '@/app/api/backup/backupRouteFileOps';
import {
  readManifest,
  type BackupManifestFile,
} from '@/app/api/backup/backupRouteUtils';

const RESTORE_JOBS_DIRECTORY = '_restore-jobs';
const RESTORE_STATUS_FILE = 'status.json';
const RESTORE_HEARTBEAT_FILE = 'heartbeat.json';
const RESTORE_JOBS_DIRECTORY_MODE = 0o777;
const RESTORE_STATE_FILE_MODE = 0o666;

export type RestoreJobPhase = 'pending' | 'running' | 'succeeded' | 'failed';

export interface RestoreJobStatus {
  id: string;
  scope: 'full-dump';
  phase: RestoreJobPhase;
  backupFolder: string;
  dumpArtifactPath: string;
  dumpFileName: string;
  manifestTimestamp: string;
  requestedAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  message?: string;
  error?: string;
}

export interface RestoreRunnerHeartbeat {
  service: 'restore-runner';
  version: 1;
  updatedAt: string;
}

export interface FullDumpRestoreTarget {
  folder: string;
  manifest: BackupManifestFile;
  dumpFileName: string;
  dumpArtifactPath: string;
  dumpAbsolutePath: string;
}

function getRestoreJobsDirectory(backupDir = getBackupDirectory()) {
  return path.join(backupDir, RESTORE_JOBS_DIRECTORY);
}

function getRestoreStatusFilePath(backupDir = getBackupDirectory()) {
  return path.join(getRestoreJobsDirectory(backupDir), RESTORE_STATUS_FILE);
}

function getRestoreHeartbeatFilePath(backupDir = getBackupDirectory()) {
  return path.join(getRestoreJobsDirectory(backupDir), RESTORE_HEARTBEAT_FILE);
}

function isSkippablePermissionNormalizationError(error: unknown) {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === 'EPERM' || code === 'EACCES' || code === 'EROFS';
}

function normalizeRestoreJobsDirectoryPermissions(jobsDirectory: string) {
  try {
    fs.chmodSync(jobsDirectory, RESTORE_JOBS_DIRECTORY_MODE);
  } catch (error) {
    if (isSkippablePermissionNormalizationError(error)) {
      return;
    }

    logger.warn('Failed to normalize restore jobs directory permissions', {
      jobsDirectory,
      error,
    });
  }
}

function ensureRestoreJobsDirectory(backupDir = getBackupDirectory()) {
  const jobsDirectory = getRestoreJobsDirectory(backupDir);
  if (!fs.existsSync(jobsDirectory)) {
    fs.mkdirSync(jobsDirectory, {
      recursive: true,
      mode: RESTORE_JOBS_DIRECTORY_MODE,
    });
  }

  normalizeRestoreJobsDirectoryPermissions(jobsDirectory);

  return jobsDirectory;
}

async function normalizeRestoreStateFilePermissions(filePath: string) {
  try {
    await fsPromises.chmod(filePath, RESTORE_STATE_FILE_MODE);
  } catch (error) {
    if (isSkippablePermissionNormalizationError(error)) {
      return;
    }

    logger.warn('Failed to normalize restore state file permissions', {
      filePath,
      error,
    });
  }
}

function readJsonFile<T>(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch (error) {
    logger.warn('Failed to parse restore state file', { filePath, error });
    return null;
  }
}

export function readRestoreJobStatus(backupDir = getBackupDirectory()) {
  return readJsonFile<RestoreJobStatus>(getRestoreStatusFilePath(backupDir));
}

export function readRestoreRunnerHeartbeat(backupDir = getBackupDirectory()) {
  return readJsonFile<RestoreRunnerHeartbeat>(
    getRestoreHeartbeatFilePath(backupDir)
  );
}

export function isRestoreJobActive(status?: RestoreJobStatus | null) {
  return status?.phase === 'pending' || status?.phase === 'running';
}

export function isRestoreRunnerAvailable(
  heartbeat?: RestoreRunnerHeartbeat | null,
  maxAgeMs = 15000
) {
  if (!heartbeat?.updatedAt) {
    return false;
  }

  const updatedAt = new Date(heartbeat.updatedAt);
  if (Number.isNaN(updatedAt.getTime())) {
    return false;
  }

  return Date.now() - updatedAt.getTime() <= maxAgeMs;
}

export async function writeRestoreJobStatus(
  status: RestoreJobStatus,
  backupDir = getBackupDirectory()
) {
  ensureRestoreJobsDirectory(backupDir);
  const filePath = getRestoreStatusFilePath(backupDir);

  const nextStatus = {
    ...status,
    updatedAt: new Date().toISOString(),
  } satisfies RestoreJobStatus;

  await writeFileAtomic(filePath, JSON.stringify(nextStatus, null, 2));
  await normalizeRestoreStateFilePermissions(filePath);

  return nextStatus;
}

export async function clearRestoreJobStatus(backupDir = getBackupDirectory()) {
  const filePath = getRestoreStatusFilePath(backupDir);
  if (!fs.existsSync(filePath)) {
    return;
  }

  await fsPromises.rm(filePath, { force: true });
}

export async function writeRestoreRunnerHeartbeat(
  heartbeat: RestoreRunnerHeartbeat,
  backupDir = getBackupDirectory()
) {
  ensureRestoreJobsDirectory(backupDir);
  const filePath = getRestoreHeartbeatFilePath(backupDir);
  await writeFileAtomic(filePath, JSON.stringify(heartbeat, null, 2));
  await normalizeRestoreStateFilePermissions(filePath);
}

export function buildPendingRestoreJobStatus(target: FullDumpRestoreTarget) {
  const requestedAt = new Date().toISOString();

  return {
    id: randomUUID(),
    scope: 'full-dump',
    phase: 'pending',
    backupFolder: target.folder,
    dumpArtifactPath: target.dumpArtifactPath,
    dumpFileName: target.dumpFileName,
    manifestTimestamp: target.manifest.timestamp,
    requestedAt,
    updatedAt: requestedAt,
    message:
      'Restore request accepted. The restore runner will stop the app and replace the Docker database.',
  } satisfies RestoreJobStatus;
}

export function resolveFullDumpRestoreTarget(
  folder: string,
  backupDir = getBackupDirectory()
) {
  const manifest = readManifest(backupDir, folder);
  if (!manifest) {
    throw new Error(`Backup manifest not found for ${folder}`);
  }

  const strategy = manifest.strategy ?? 'full';
  if (strategy !== 'full') {
    throw new Error(
      'Only full PostgreSQL dump backups can be restored from the UI.'
    );
  }

  const dumpFile = manifest.files.find((file) => file.name.endsWith('.dump'));
  if (!dumpFile?.path || !dumpFile.name) {
    throw new Error('Backup manifest does not include a PostgreSQL dump file.');
  }

  const dumpAbsolutePath = path.resolve(backupDir, dumpFile.path);
  const resolvedBackupDir = path.resolve(backupDir);
  if (!dumpAbsolutePath.startsWith(`${resolvedBackupDir}${path.sep}`)) {
    throw new Error('Resolved dump path escaped the backup directory.');
  }

  if (!fs.existsSync(dumpAbsolutePath)) {
    throw new Error(`Dump file not found: ${dumpFile.name}`);
  }

  return {
    folder,
    manifest,
    dumpFileName: dumpFile.name,
    dumpArtifactPath: dumpFile.path,
    dumpAbsolutePath,
  } satisfies FullDumpRestoreTarget;
}
