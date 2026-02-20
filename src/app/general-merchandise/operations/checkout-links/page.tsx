import { CheckoutLinksRoutePage } from '@/app/operations/checkout-links/_shared/CheckoutLinksRoutePage';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function GeneralMerchandiseCheckoutLinksPage() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/checkout-links',
    <CheckoutLinksRoutePage
      apiBasePath="/api/general-merchandise"
      checkoutLinksApiBasePath="/api"
    />
  );
}
