import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { BrowseError } from './dumpPreview';
import { logger } from '@/lib/logger';

export async function browseResponse(load: () => Promise<unknown>) {
  try {
    await requireAdmin();
  } catch (error) {
    const unauthorized =
      error instanceof Error && error.message === 'Unauthorized';
    return NextResponse.json(
      {
        error: unauthorized
          ? 'Authentication required'
          : 'Admin access required',
      },
      { status: unauthorized ? 401 : 403 }
    );
  }
  try {
    return NextResponse.json(await load(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (!(error instanceof BrowseError)) {
      logger.error('Backup browse failed', error);
    }
    const status = error instanceof BrowseError ? error.status : 500;
    return NextResponse.json(
      {
        error:
          error instanceof BrowseError
            ? error.message
            : 'Unable to browse this backup.',
      },
      { status, headers: status === 503 ? { 'Retry-After': '3' } : undefined }
    );
  }
}
