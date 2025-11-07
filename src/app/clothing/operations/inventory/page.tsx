/**
 * Inventory Page Route
 * Renders the clothing operations inventory workspace using the reusable table template.
 */

import { PageLayout } from '@/components/layout/PageLayout';
import { InventoryPage } from '@/modules/clothing/operations/inventory';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export default async function InventoryRoute() {
  const hasAccess = await hasModuleAccess('/clothing/operations/inventory');
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <PageLayout fluid withPadding>
        <InventoryPage />
      </PageLayout>
    </PermissionGuard>
  );
}
