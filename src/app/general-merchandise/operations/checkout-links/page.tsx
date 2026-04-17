import { CheckoutLinksRoutePage } from '@/app/operations/checkout-links/_shared/CheckoutLinksRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function GeneralMerchandiseCheckoutLinksPage() {
  return renderOperationsPage(
    '/general-merchandise/operations/checkout-links',
    <CheckoutLinksRoutePage
      apiBasePath="/api/general-merchandise"
      checkoutLinksApiBasePath="/api"
    />
  );
}
