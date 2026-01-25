/**
 * GM Shipments Page Route Handler
 */

import { ShipmentsPage } from '@/modules/clothing/operations/shipments/components/ShipmentsPage';
import { ShipmentsErrorBoundary } from '@/app/clothing/operations/shipments/components/ShipmentsErrorBoundary';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export default async function Page() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/operations/shipments'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <ShipmentsErrorBoundary>
        <ShipmentsPage apiBasePath="/api/general-merchandise" />
      </ShipmentsErrorBoundary>
    </PermissionGuard>
  );
}
