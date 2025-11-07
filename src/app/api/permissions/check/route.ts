import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export async function POST(request: NextRequest) {
  try {
    const { modulePath } = await request.json();

    const hasAccess = await hasModuleAccess(modulePath);
    const redirectTo = await getFirstAccessibleModule();

    return NextResponse.json({ hasAccess, redirectTo });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check permissions' },
      { status: 500 }
    );
  }
}
