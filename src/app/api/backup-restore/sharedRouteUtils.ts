import fs from 'fs';
import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';

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
