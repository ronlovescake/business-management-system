/**
 * Module Permission Utilities
 * Provides granular permission checking for module-based access control.
 */

import { getCurrentUser } from './session';
import { prisma } from '@/lib/db';

/**
 * Check if the current user has access to a specific module path
 */
export async function hasModuleAccess(modulePath: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) {
    return false;
  }

  // Super admins and Admins have access to everything
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
    return true;
  }

  // Check if user has permission for this specific module
  const moduleRecord = await prisma.module.findUnique({
    where: { path: modulePath },
  });

  if (!moduleRecord) {
    return false;
  }

  const permission = await prisma.userPermission.findUnique({
    where: {
      userId_moduleId: {
        userId: user.id,
        moduleId: moduleRecord.id,
      },
    },
  });

  return permission?.canAccess ?? false;
}

/**
 * Get the first accessible module path for the current user
 */
export async function getFirstAccessibleModule(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  // Super admins and Admins default to operations
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
    return '/clothing/operations/transactions';
  }

  // For regular users, find their first permitted module
  const userPermissions = await prisma.userPermission.findMany({
    where: {
      userId: user.id,
      canAccess: true,
    },
    include: {
      module: true,
    },
    orderBy: {
      module: {
        sortOrder: 'asc',
      },
    },
    take: 1,
  });

  if (userPermissions.length > 0) {
    return userPermissions[0].module.path;
  }

  return null;
}

/**
 * Get all accessible module paths for the current user
 */
export async function getAccessibleModules(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) {
    return [];
  }

  // Super admins and Admins have access to all modules
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
    const allModules = await prisma.module.findMany({
      where: { isActive: true },
      select: { path: true },
    });
    return allModules.map((m) => m.path);
  }

  // For regular users, get their permitted modules
  const userPermissions = await prisma.userPermission.findMany({
    where: {
      userId: user.id,
      canAccess: true,
    },
    include: {
      module: {
        select: {
          path: true,
          isActive: true,
        },
      },
    },
  });

  return userPermissions
    .filter((p) => p.module.isActive)
    .map((p) => p.module.path);
}
