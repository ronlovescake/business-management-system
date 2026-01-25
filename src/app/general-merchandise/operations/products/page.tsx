/**
 * GM Products Page Route Handler
 */

import type { Metadata } from 'next';
import { ProductsPage } from '@/modules/clothing/operations/products/components/ProductsPage';
import { ProductsErrorBoundary } from '@/modules/clothing/operations/products/components/ProductsErrorBoundary';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export const metadata: Metadata = {
  title: 'Products',
};

export default async function Page() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/operations/products'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <ProductsErrorBoundary>
        <ProductsPage apiBasePath="/api/general-merchandise" />
      </ProductsErrorBoundary>
    </PermissionGuard>
  );
}
