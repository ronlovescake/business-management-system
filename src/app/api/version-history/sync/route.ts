import { NextRequest, NextResponse } from 'next/server';

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

    // TODO: Save to database
    // For now, just log and acknowledge
    console.log(
      `📤 Syncing ${versions.length} versions for: ${dataKey} at ${new Date(timestamp).toLocaleString()}`
    );

    // In production, you would save these to a database:
    // await prisma.versionHistory.createMany({
    //   data: versions.map((v) => ({
    //     ...v,
    //     dataKey,
    //   })),
    //   skipDuplicates: true,
    // });

    return NextResponse.json({
      success: true,
      message: `Synced ${versions.length} versions`,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Failed to sync version history:', error);
    return NextResponse.json(
      { error: 'Failed to sync version history' },
      { status: 500 }
    );
  }
}
