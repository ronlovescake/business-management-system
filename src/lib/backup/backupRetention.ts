import fs from 'fs';
import path from 'path';

import { logger } from '@/lib/logger';
import { getBackupDirectory } from '@/lib/backup-storage';
import {
  listBackupFoldersDescending,
  parseTimestampToDate,
  readManifest,
} from '@/app/api/backup/backupRouteUtils';

export type BackupPruneResult = {
  retentionDays: number;
  cutoff: string;
  prunedFolders: string[];
  skippedFolders: string[];
};

type BackupFolderInfo = {
  folder: string;
  date: Date | null;
  manifestBaseFolder: string | null;
  strategy: string | null;
};

export function pruneExpiredBackups(retentionDays: number): BackupPruneResult {
  const backupDir = getBackupDirectory();
  const now = new Date();
  const cutoffDate = new Date(
    now.getTime() - retentionDays * 24 * 60 * 60 * 1000
  );
  const prunedFolders: string[] = [];
  const skippedFolders: string[] = [];

  if (retentionDays < 1 || !fs.existsSync(backupDir)) {
    return {
      retentionDays,
      cutoff: cutoffDate.toISOString(),
      prunedFolders,
      skippedFolders,
    };
  }

  const folders = listBackupFoldersDescending(backupDir);
  const folderInfo = folders.map((folder): BackupFolderInfo => {
    const manifest = readManifest(backupDir, folder);
    return {
      folder,
      date: parseTimestampToDate(manifest?.timestamp ?? folder),
      manifestBaseFolder: manifest?.baseFolder ?? null,
      strategy: manifest?.strategy ?? null,
    };
  });

  const protectedFolders = new Set<string>();
  const newestFull = folderInfo.find((entry) => entry.strategy === 'full');
  if (newestFull) {
    protectedFolders.add(newestFull.folder);
  }

  for (const entry of folderInfo) {
    if (!entry.date || entry.date >= cutoffDate) {
      if (entry.manifestBaseFolder) {
        protectedFolders.add(entry.manifestBaseFolder);
      }
    }
  }

  const expiredEntries = [...folderInfo]
    .filter((entry) => entry.date && entry.date < cutoffDate)
    .sort((left, right) => {
      const leftTime = left.date?.getTime() ?? 0;
      const rightTime = right.date?.getTime() ?? 0;
      return leftTime - rightTime;
    });

  for (const entry of expiredEntries) {
    if (protectedFolders.has(entry.folder)) {
      skippedFolders.push(entry.folder);
      continue;
    }

    const targetPath = path.join(backupDir, entry.folder);
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      prunedFolders.push(entry.folder);
    } catch (error) {
      logger.warn('Failed to prune expired backup folder', {
        folder: entry.folder,
        error,
      });
      skippedFolders.push(entry.folder);
    }
  }

  return {
    retentionDays,
    cutoff: cutoffDate.toISOString(),
    prunedFolders,
    skippedFolders,
  };
}
