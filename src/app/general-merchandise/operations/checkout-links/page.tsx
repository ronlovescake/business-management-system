import { PageLayout } from '@/components/layout/PageLayout';
import { CheckoutLinksComponent } from '@/modules/clothing/operations/checkout-links/components/CheckoutLinksComponent';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function GeneralMerchandiseCheckoutLinksPage() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/checkout-links',
    <PageLayout fluid withPadding>
      <CheckoutLinksComponent
        apiBasePath="/api/general-merchandise"
        checkoutLinksApiBasePath="/api"
      />
    </PageLayout>
  );
}
