import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// GET: Load version history from server
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataKey = searchParams.get('dataKey');

    if (!dataKey) {
      return NextResponse.json(
        { error: 'dataKey parameter is required' },
        { status: 400 }
      );
    }

    // TODO: Fetch from database
    // For now, return empty array (will be implemented when Prisma schema is updated)
    logger.debug(`📥 GET version history for: ${dataKey}`);

    return NextResponse.json([]);
  } catch (error) {
    logger.error('Failed to load version history:', error);
    return NextResponse.json(
      { error: 'Failed to load version history' },
      { status: 500 }
    );
  }
}
