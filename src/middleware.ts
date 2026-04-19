import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAuthBypassed } from '@/lib/auth/bypass';
import { getRequiredRolesForPath } from '@/core/routePermissions';

const shouldBypassAuth = isAuthBypassed();

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const internalJobToken = (process.env.INTERNAL_JOB_TOKEN || '').trim();
  const providedInternalToken = (
    req.headers.get('x-internal-token') || ''
  ).trim();

  if (shouldBypassAuth) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith('/api/internal/') &&
    internalJobToken &&
    providedInternalToken === internalJobToken
  ) {
    return NextResponse.next();
  }

  // Allow public routes
  if (
    pathname === '/login' ||
    pathname === '/' ||
    pathname === '/api/health' ||
    pathname === '/api/security/csp-report' ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next();
  }

  // Check if user is authenticated
  const { getToken } = await import('next-auth/jwt');
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      );
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Check route permissions
  const userRole = token.role as string;
  const unauthorizedRedirect = pathname.startsWith('/general-merchandise')
    ? '/general-merchandise/operations'
    : '/clothing/operations';

  // Find matching route permission (longest-prefix match for correctness;
  // see src/core/routePermissions.ts).
  const allowedRoles = getRequiredRolesForPath(pathname);
  if (allowedRoles && !allowedRoles.includes('*')) {
    if (!allowedRoles.includes(userRole as 'USER' | 'ADMIN' | 'SUPER_ADMIN')) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { 'content-type': 'application/json' } }
        );
      }
      return NextResponse.redirect(new URL(unauthorizedRedirect, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
