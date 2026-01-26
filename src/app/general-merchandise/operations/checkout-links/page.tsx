import { PageLayout } from '@/components/layout/PageLayout';
import { CheckoutLinksComponent } from '@/modules/clothing/operations/checkout-links/components/CheckoutLinksComponent';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export default async function GeneralMerchandiseCheckoutLinksPage() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/operations/checkout-links'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <PageLayout fluid withPadding>
        <CheckoutLinksComponent
          apiBasePath="/api/general-merchandise"
          checkoutLinksApiBasePath="/api"
        />
      </PageLayout>
    </PermissionGuard>
  );
}
