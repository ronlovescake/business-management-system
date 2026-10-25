import type { NextRequest } from 'next/server';
import { getBrowseCatalog } from '@/lib/backup/browseBackup';
import { browseResponse } from '@/lib/backup/browseResponse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { timestamp: string } }
) {
  return browseResponse(() =>
    getBrowseCatalog(params.timestamp, request.signal)
  );
}
