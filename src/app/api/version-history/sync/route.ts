import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';

// POST: Sync version history to server
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dataKey, versions, timestamp } = body;

    if (!dataKey || !versions || !Array.isArray(versions)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Sanitize dataKey
    const sanitizedDataKey = sanitizers.name(dataKey);

    // FUTURE: Persist version history to database
    // Currently handled client-side via IndexedDB only
    // Backend persistence deferred until version history schema is finalized
    logger.debug(
      `📤 Syncing ${versions.length} versions for: ${sanitizedDataKey} at ${new Date(timestamp).toLocaleString()}`
    );

    // Future implementation:
    // await prisma.versionHistory.createMany({
    //   data: versions.map((v) => ({
    //     ...v,
    //     dataKey,
    //   })),
    // });
    //   skipDuplicates: true,
    // });

    return NextResponse.json({
      success: true,
      message: `Synced ${versions.length} versions`,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to sync version history:', error);
    return NextResponse.json(
      { error: 'Failed to sync version history' },
      { status: 500 }
    );
  }
}
