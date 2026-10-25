import type { NextRequest } from 'next/server';
import { getBrowseRows } from '@/lib/backup/browseBackup';
import { BrowseError } from '@/lib/backup/dumpPreview';
import { browseResponse } from '@/lib/backup/browseResponse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { timestamp: string; table: string } }
) {
  return browseResponse(async () => {
    const url = new URL(request.url);
    const offset = Number(url.searchParams.get('offset') ?? '0');
    const limit = Number(url.searchParams.get('limit') ?? '250');
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      ![100, 250, 500].includes(limit)
    ) {
      throw new BrowseError('Invalid page parameters', 400);
    }
    return getBrowseRows(
      params.timestamp,
      params.table,
      offset,
      limit,
      request.signal
    );
  });
}
