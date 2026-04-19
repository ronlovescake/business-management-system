/**
 * Centralized route → allowed-roles map consumed by the auth middleware.
 *
 * Why this lives in its own file instead of being inlined into the
 * middleware: the middleware runs in the Next.js edge runtime, which is
 * highly constrained (no Node built-ins, no heavy imports, cold-start
 * sensitive). The previous IMPROVEMENTS_CHECKLIST item proposed deriving
 * this map directly from `src/core/ModuleRegistry.ts`. Doing that at
 * request time risks pulling Prisma/other server-only code into the edge
 * bundle. As a safer first step, this module exports the data shape so
 * both the middleware and any future registry-derived generator can
 * agree on a single source of truth.
 *
 * NEXT STEP (deferred): make `ModuleRegistry.register()` (or a build-time
 * codegen step) emit this exact object so adding a module also wires its
 * route ACL automatically. Until that codegen exists, edits to access
 * control happen here.
 */

export type RouteRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN' | '*';

export const ROUTE_PERMISSIONS: Record<string, RouteRole[]> = {
  // Public routes - no authentication required
  '/login': ['*'],

  // Operations routes - All authenticated users
  '/clothing/operations': ['USER', 'ADMIN', 'SUPER_ADMIN'],
  '/clothing/operations/customers': ['USER', 'ADMIN', 'SUPER_ADMIN'],
  '/clothing/operations/dispatch': ['USER', 'ADMIN', 'SUPER_ADMIN'],
  '/clothing/operations/transactions': ['USER', 'ADMIN', 'SUPER_ADMIN'],
  '/clothing/operations/sorting': ['USER', 'ADMIN', 'SUPER_ADMIN'],

  // General Merchandise operations routes - All authenticated users
  '/general-merchandise/operations': ['USER', 'ADMIN', 'SUPER_ADMIN'],
  '/general-merchandise/operations/customers': ['USER', 'ADMIN', 'SUPER_ADMIN'],
  '/general-merchandise/operations/dispatch': ['USER', 'ADMIN', 'SUPER_ADMIN'],
  '/general-merchandise/operations/transactions': [
    'USER',
    'ADMIN',
    'SUPER_ADMIN',
  ],
  '/general-merchandise/operations/sorting': ['USER', 'ADMIN', 'SUPER_ADMIN'],

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
  '/clothing/accounting': ['ADMIN', 'SUPER_ADMIN'],
  '/clothing/ledger': ['ADMIN', 'SUPER_ADMIN'],

  // General Merchandise employees/accounting routes - Admin and Super Admin only
  '/general-merchandise/employees': ['ADMIN', 'SUPER_ADMIN'],
  '/general-merchandise/employees/management': ['ADMIN', 'SUPER_ADMIN'],
  '/general-merchandise/employees/attendance': ['ADMIN', 'SUPER_ADMIN'],
  '/general-merchandise/employees/schedule': ['ADMIN', 'SUPER_ADMIN'],
  '/general-merchandise/employees/payroll': ['ADMIN', 'SUPER_ADMIN'],
  '/general-merchandise/employees/leave-requests': ['ADMIN', 'SUPER_ADMIN'],
  '/general-merchandise/employees/cash-advances': ['ADMIN', 'SUPER_ADMIN'],
  '/general-merchandise/employees/thirteenth-month': ['ADMIN', 'SUPER_ADMIN'],
  '/general-merchandise/employees/expenses': ['ADMIN', 'SUPER_ADMIN'],
  '/general-merchandise/accounting': ['ADMIN', 'SUPER_ADMIN'],
  '/general-merchandise/ledger': ['ADMIN', 'SUPER_ADMIN'],

  // Trucking operations - All authenticated users (matches modules/trucking/operations/*)
  '/trucking/operations': ['USER', 'ADMIN', 'SUPER_ADMIN'],
  '/trucking/operations/trips': ['USER', 'ADMIN', 'SUPER_ADMIN'],
  '/trucking/operations/vehicle-assignments': ['USER', 'ADMIN', 'SUPER_ADMIN'],
  '/trucking/operations/fleet-registry': ['USER', 'ADMIN', 'SUPER_ADMIN'],

  // Settings/Admin routes - Super Admin only
  '/settings': ['SUPER_ADMIN'],
  '/clothing/settings': ['SUPER_ADMIN'],
  '/clothing/users': ['SUPER_ADMIN'],

  // Personal finance - all authenticated users
  '/personal': ['USER', 'ADMIN', 'SUPER_ADMIN'],

  // Profile route - All authenticated users
  '/profile': ['USER', 'ADMIN', 'SUPER_ADMIN'],
};

/**
 * Returns the required roles for the longest matching prefix in the
 * ROUTE_PERMISSIONS table, or null if no entry matches.
 */
export function getRequiredRolesForPath(pathname: string): RouteRole[] | null {
  let bestMatchLength = -1;
  let bestRoles: RouteRole[] | null = null;
  for (const [route, roles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(route) && route.length > bestMatchLength) {
      bestMatchLength = route.length;
      bestRoles = roles;
    }
  }
  return bestRoles;
}
