/**
 * GM Prices Route Handler
 */

import { PricesPage } from '@/modules/clothing/operations/prices/components/PricesPage';
import { PricesErrorBoundary } from '@/modules/clothing/operations/prices/components/PricesErrorBoundary';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export default async function Page() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/operations/prices'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <PricesErrorBoundary>
        <PricesPage apiBasePath="/api/general-merchandise" />
      </PricesErrorBoundary>
    </PermissionGuard>
  );
}
