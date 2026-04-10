import fs from 'fs';
import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';

export const TIMESTAMP_FOLDER_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(-(?:full|differential|log)-backup)?$/;

export function isValidTimestampFolderName(timestamp: string) {
  return TIMESTAMP_FOLDER_REGEX.test(timestamp);
}

export function extractTimestampFromFolder(folder: string) {
  return folder.replace(/-(full|differential|log)-backup$/, '');
}

export function isSafeBackupFilename(filename: string) {
  if (!filename) {
    return false;
  }

  if (
    filename.includes('..') ||
    filename.includes('/') ||
    filename.includes('\\')
  ) {
    return false;
  }

  return true;
}

export async function requireBackupRestoreAdmin() {
  try {
    await requireAdmin();
    return null;
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Forbidden: Admin access required' },
      { status: 403 }
    );
  }
}

export async function computeFileSha256(filePath: string) {
  return await new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
