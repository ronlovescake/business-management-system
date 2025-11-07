/**
 * Customers Route Handler
 * Delegates to the modular CustomersPage component
 * Direct import path used to optimize compilation speed
 */
import { CustomersPage } from '@/modules/clothing/operations/customers/components/CustomersPage';
import { CustomersErrorBoundary } from '@/modules/clothing/operations/customers/components/CustomersErrorBoundary';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export default async function Page() {
  const hasAccess = await hasModuleAccess('/clothing/operations/customers');
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <CustomersErrorBoundary>
        <CustomersPage />
      </CustomersErrorBoundary>
    </PermissionGuard>
  );
}
