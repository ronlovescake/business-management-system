import { NextRequest, NextResponse } from 'next/server';

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
    console.log(`📥 GET version history for: ${dataKey}`);

    return NextResponse.json([]);
  } catch (error) {
    console.error('Failed to load version history:', error);
    return NextResponse.json(
      { error: 'Failed to load version history' },
      { status: 500 }
    );
  }
}
