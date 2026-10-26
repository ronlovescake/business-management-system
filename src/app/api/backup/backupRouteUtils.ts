import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/logger';
import type { RestoreVerificationSnapshot } from '@/lib/backup/restoreVerification';
import { TIMESTAMP_FOLDER_REGEX } from '@/app/api/backup-restore/sharedRouteUtils';

export type BackupStrategy = 'full' | 'differential' | 'log';

export interface BackupSchedulerMetadata {
  trigger: 'manual' | 'scheduled';
  triggeredAt: string;
  scheduleTime?: string;
  scheduleCadence?: 'daily' | 'weekly';
  scheduleDayOfWeek?: string;
  timeZone?: string;
  scheduledDateKey?: string;
  catchUp?: boolean;
  missedDateKeys?: string[];
}

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
  restoreVerification?: RestoreVerificationSnapshot;
  scheduler?: BackupSchedulerMetadata;
}

export interface BackupLookup {
  folder: string;
  manifest: BackupManifestFile;
}

export type BackupFileDescriptor = {
  filePath: string;
  size: number;
};

export function buildTableQueryOptions(
  sampleRecord: Record<string, unknown> | null,
  {
    model,
    includeSoftDeleted,
    strategy,
    differentialSince,
  }: {
    model: string;
    includeSoftDeleted: boolean;
    strategy: BackupStrategy;
    differentialSince: Date | null;
  }
) {
  const where: Record<string, unknown> = {};
  const hasDeletedAt = !!(sampleRecord && 'deletedAt' in sampleRecord);
  const hasUpdatedAt = !!(sampleRecord && 'updatedAt' in sampleRecord);
  let differentialUnsupported = false;

  if (hasDeletedAt && !includeSoftDeleted) {
    where.deletedAt = null;
  }
  if (
    (model === 'productCodeAlias' ||
      model === 'generalMerchandiseProductCodeAlias') &&
    !includeSoftDeleted
  ) {
    where.product = { deletedAt: null };
  }
  if (!includeSoftDeleted && model === 'clothingSupplierCredit') {
    where.sourceProduct = { deletedAt: null };
  }
  if (!includeSoftDeleted && model === 'clothingSupplierCreditApplication') {
    where.targetProduct = { deletedAt: null };
    where.credit = { sourceProduct: { deletedAt: null } };
  }
  if (!includeSoftDeleted && model === 'clothingProductShipmentTransfer') {
    where.product = { deletedAt: null };
  }
  if (
    !includeSoftDeleted &&
    [
      'transactionPayment',
      'transactionRefund',
      'transactionStatusChange',
      'clothingOrderCancellation',
    ].includes(model)
  ) {
    where.transaction = { deletedAt: null };
  }
  if (!includeSoftDeleted && model === 'clothingRefundPayout') {
    where.cancellation = { transaction: { deletedAt: null } };
    where.refund = { deletedAt: null };
  }
  if (!includeSoftDeleted && model === 'clothingFinancialRequest') {
    where.OR = [
      {
        payments: {
          some: { deletedAt: null, transaction: { deletedAt: null } },
        },
      },
      { cancellation: { transaction: { deletedAt: null } } },
      {
        payout: {
          cancellation: { transaction: { deletedAt: null } },
          refund: { deletedAt: null },
        },
      },
      {
        operation: {
          in: ['ZERO_COST_CONFIRMATION', 'INVENTORY_COST_CORRECTION'],
        },
      },
    ];
  }

  if (strategy === 'differential' && differentialSince) {
    if (hasUpdatedAt) {
      where.updatedAt = { gte: differentialSince };
    } else {
      differentialUnsupported = true;
    }
  }

  return { where, hasDeletedAt, hasUpdatedAt, differentialUnsupported };
}

export function buildBackupFolderTimestamp(date: Date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

export function sanitizeTimestamp(timestamp: string) {
  const bare = timestamp.replace(/-(full|differential|log)-backup$/, '');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/.test(bare)) {
    return bare.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3Z');
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
    .filter(
      (entry) => entry.isDirectory() && TIMESTAMP_FOLDER_REGEX.test(entry.name)
    )
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
