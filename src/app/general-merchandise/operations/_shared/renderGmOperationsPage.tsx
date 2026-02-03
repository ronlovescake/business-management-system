import type { ReactNode } from 'react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  getFirstAccessibleModule,
  hasModuleAccess,
} from '@/lib/auth/permissions';

export async function renderGmOperationsPage(
  modulePath: string,
  children: ReactNode
) {
  const hasAccess = await hasModuleAccess(modulePath);
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      {children}
    </PermissionGuard>
  );
}
