import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session.user;
}

export async function requireRole(allowedRoles: string[]) {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new Error('Forbidden: Insufficient permissions');
  }
  return user;
}

export async function requireSuperAdmin() {
  return await requireRole(['SUPER_ADMIN']);
}

export async function requireAdmin() {
  return await requireRole(['ADMIN', 'SUPER_ADMIN']);
}

export async function hasRole(role: string | string[]) {
  const user = await getCurrentUser();
  if (!user) {
    return false;
  }

  const roles = Array.isArray(role) ? role : [role];
  return roles.includes(user.role);
}

export async function isSuperAdmin() {
  return await hasRole('SUPER_ADMIN');
}

export async function isAdmin() {
  return await hasRole(['ADMIN', 'SUPER_ADMIN']);
}
