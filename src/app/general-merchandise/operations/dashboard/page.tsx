/**
 * GM Dashboard Page Route Handler
 */

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { DashboardPage } from '@/modules/clothing/operations/dashboard/components/DashboardPage';

export default async function Page() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/operations/dashboard'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <DashboardPage />
    </PermissionGuard>
  );
}
