import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Define route access control
const routePermissions: Record<string, string[]> = {
  // Public routes - no authentication required
  '/login': ['*'],

  // Operations routes - All authenticated users
  '/clothing/operations': ['USER', 'ADMIN', 'SUPER_ADMIN'],
  '/clothing/operations/customers': ['USER', 'ADMIN', 'SUPER_ADMIN'],
  '/clothing/operations/dispatch': ['USER', 'ADMIN', 'SUPER_ADMIN'],
  '/clothing/operations/transactions': ['USER', 'ADMIN', 'SUPER_ADMIN'],
  '/clothing/operations/sorting': ['USER', 'ADMIN', 'SUPER_ADMIN'],

  // Employees routes - Admin and Super Admin only
  '/clothing/employees': ['ADMIN', 'SUPER_ADMIN'],
  '/clothing/employees/management': ['ADMIN', 'SUPER_ADMIN'],
  '/clothing/employees/attendance': ['ADMIN', 'SUPER_ADMIN'],
  '/clothing/employees/schedule': ['ADMIN', 'SUPER_ADMIN'],
  '/clothing/employees/payroll': ['ADMIN', 'SUPER_ADMIN'],
  '/clothing/employees/leave-requests': ['ADMIN', 'SUPER_ADMIN'],
  '/clothing/employees/cash-advances': ['ADMIN', 'SUPER_ADMIN'],
  '/clothing/employees/thirteenth-month': ['ADMIN', 'SUPER_ADMIN'],
  '/clothing/employees/expenses': ['ADMIN', 'SUPER_ADMIN'],

  // Settings/Admin routes - Super Admin only
  '/clothing/settings': ['SUPER_ADMIN'],
  '/clothing/users': ['SUPER_ADMIN'],

  // Profile route - All authenticated users
  '/profile': ['USER', 'ADMIN', 'SUPER_ADMIN'],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (
    pathname === '/login' ||
    pathname === '/' ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next();
  }

  // Check if user is authenticated
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Check route permissions
  const userRole = token.role as string;

  // Find matching route permission
  for (const [route, allowedRoles] of Object.entries(routePermissions)) {
    if (pathname.startsWith(route) && !allowedRoles.includes('*')) {
      if (!allowedRoles.includes(userRole)) {
        // Redirect to unauthorized page or home
        return NextResponse.redirect(new URL('/clothing/operations', req.url));
      }
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
