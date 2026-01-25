import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Force dynamic rendering - API routes should not be statically generated
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  return NextResponse.json(
    {
      error:
        'This endpoint is disabled. Use /api/clothing/employees/dashboard or /api/general-merchandise/employees/dashboard.',
    },
    { status: 404 }
  );
}
