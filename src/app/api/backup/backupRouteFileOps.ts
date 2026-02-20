import fsPromises from 'fs/promises';
import path from 'path';
import * as XLSX from 'xlsx';
import { computeFileSha256 } from '../backup-restore/sharedRouteUtils';

export function writeWorkbookToFile(workbook: XLSX.WorkBook, filePath: string) {
  const buffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'buffer',
    compression: true,
  });
  return writeFileAtomic(filePath, buffer as Buffer);
}

export async function writeFileAtomic(
  filePath: string,
  content: string | Buffer
) {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fsPromises.writeFile(tempPath, content);
  await fsPromises.rename(tempPath, filePath);
}

export async function buildFileChecksums(filePaths: string[]) {
  const checksums: Record<string, string> = {};

  for (const filePath of filePaths) {
    const checksum = await computeFileSha256(filePath);
    checksums[path.basename(filePath)] = checksum;
  }

  return checksums;
}

export async function verifyFileChecksums(
  filePaths: string[],
  expectedChecksums: Record<string, string>
) {
  for (const filePath of filePaths) {
    const fileName = path.basename(filePath);
    const expected = expectedChecksums[fileName];
    if (!expected) {
      return false;
    }

    const actual = await computeFileSha256(filePath);
    if (actual !== expected) {
      return false;
    }
  }

  return true;
}

export function parseBooleanFlag(value: string | undefined) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export function isStrictMissingTablesEnabled() {
  return parseBooleanFlag(process.env.BACKUP_STRICT_TABLES);
}
