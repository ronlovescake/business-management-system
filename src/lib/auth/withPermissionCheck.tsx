/**
 * Higher-order function to wrap pages with permission checking
 */

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export async function withPermissionCheck(
  modulePath: string,
  PageComponent: React.ComponentType
) {
  const hasAccess = await hasModuleAccess(modulePath);
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <PageComponent />
    </PermissionGuard>
  );
}
