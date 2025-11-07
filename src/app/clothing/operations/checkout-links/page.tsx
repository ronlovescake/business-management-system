/**
 * Checkout Links Page
 * Manage payment checkout links for customers
 */

import { PageLayout } from '@/components/layout/PageLayout';
import { CheckoutLinksComponent } from '@/modules/clothing/operations/checkout-links/components/CheckoutLinksComponent';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export default async function CheckoutLinksPage() {
  const hasAccess = await hasModuleAccess(
    '/clothing/operations/checkout-links'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <PageLayout fluid withPadding>
        <CheckoutLinksComponent />
      </PageLayout>
    </PermissionGuard>
  );
}
