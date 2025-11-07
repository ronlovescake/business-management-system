/**
 * Prices Page - Route Handler
 *
 * Delegates to the modular PricesPage component from the prices module.
 * Direct import path used to optimize compilation speed.
 * Original implementation: 1,679 lines
 * New implementation: 11 lines (99.3% reduction)
 */

import { PricesPage } from '@/modules/clothing/operations/prices/components/PricesPage';
import { PricesErrorBoundary } from '@/modules/clothing/operations/prices/components/PricesErrorBoundary';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export default async function Page() {
  const hasAccess = await hasModuleAccess('/clothing/operations/prices');
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <PricesErrorBoundary>
        <PricesPage />
      </PricesErrorBoundary>
    </PermissionGuard>
  );
}
