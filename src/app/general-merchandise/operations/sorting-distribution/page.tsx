/**
 * GM Sorting Distribution Page Route Handler
 */

import { SortingDistributionPage } from '@/modules/clothing/operations/sorting-distribution/components/SortingDistributionPage';
import { SortingDistributionErrorBoundary } from '@/app/clothing/operations/sorting-distribution/components/SortingDistributionErrorBoundary';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export default async function Page() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/operations/sorting-distribution'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <SortingDistributionErrorBoundary>
        <SortingDistributionPage apiBasePath="/api/general-merchandise" />
      </SortingDistributionErrorBoundary>
    </PermissionGuard>
  );
}
