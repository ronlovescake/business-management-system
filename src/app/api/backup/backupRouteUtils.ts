import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/logger';

export type BackupStrategy = 'full' | 'differential' | 'log';

export interface BackupManifestFile {
  timestamp: string;
  database: string;
  format: string;
  strategy?: BackupStrategy;
  includeSoftDeleted?: boolean;
  baseTimestamp?: string | null;
  baseFolder?: string | null;
  changeWindow?: {
    since: string | null;
    until: string;
  } | null;
  files: Array<{
    name: string;
    size: number;
    path: string;
    checksum?: string;
  }>;
  recordCounts?: Record<string, number>;
  differentialFallbackTables?: string[];
  logStats?: Record<string, number>;
  integrity?: {
    algorithm: 'sha256';
    verified: boolean;
    generatedAt: string;
    fileChecksums: Record<string, string>;
  };
}

export interface BackupLookup {
  folder: string;
  manifest: BackupManifestFile;
}

export type BackupFileDescriptor = {
  filePath: string;
  size: number;
};

export function sanitizeTimestamp(timestamp: string) {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/.test(timestamp)) {
    return timestamp.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3Z');
  }
  return timestamp;
}

export function parseTimestampToDate(timestamp?: string | null) {
  if (!timestamp) {
    return null;
  }
  const normalized = sanitizeTimestamp(timestamp);
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function listBackupFoldersDescending(backupDir: string) {
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  return fs
    .readdirSync(backupDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
}

export async function describeFiles(
  filePaths: string[]
): Promise<BackupFileDescriptor[]> {
  if (!filePaths.length) {
    return [];
  }

  return Promise.all(
    filePaths.map(async (filePath) => {
      try {
        const stats = await fsPromises.stat(filePath);
        return { filePath, size: stats.size };
      } catch (error) {
        logger.warn('Failed to read file stats', { filePath, error });
        return { filePath, size: 0 };
      }
    })
  );
}

export function readManifest(
  backupDir: string,
  folder: string
): BackupManifestFile | null {
  const manifestPath = path.join(backupDir, folder, 'MANIFEST.json');
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    return JSON.parse(
      fs.readFileSync(manifestPath, 'utf8')
    ) as BackupManifestFile;
  } catch (error) {
    logger.warn('Failed to parse manifest', { folder, error });
    return null;
  }
}

export function findLatestBackupByStrategy(
  backupDir: string,
  strategy: BackupStrategy
): BackupLookup | null {
  const folders = listBackupFoldersDescending(backupDir);
  for (const folder of folders) {
    const manifest = readManifest(backupDir, folder);
    if (manifest?.strategy === strategy) {
      return { folder, manifest };
    }
  }
  return null;
}
