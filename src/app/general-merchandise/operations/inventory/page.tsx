/**
 * GM Inventory Page Route Handler
 */

import { InventoryPage } from '@/modules/clothing/operations/inventory/components/InventoryPage';
import { InventoryErrorBoundary } from '@/app/clothing/operations/inventory/components/InventoryErrorBoundary';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export default async function Page() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/operations/inventory'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <InventoryErrorBoundary>
        <InventoryPage apiBasePath="/api/general-merchandise" />
      </InventoryErrorBoundary>
    </PermissionGuard>
  );
}
