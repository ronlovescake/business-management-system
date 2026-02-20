import { PageLayout } from '@/components/layout/PageLayout';
import { CheckoutLinksComponent } from '@/modules/clothing/operations/checkout-links/components/CheckoutLinksComponent';

type CheckoutLinksRoutePageProps = {
  apiBasePath?: string;
  checkoutLinksApiBasePath?: string;
};

export function CheckoutLinksRoutePage(props: CheckoutLinksRoutePageProps) {
  const { apiBasePath, checkoutLinksApiBasePath } = props;

  return (
    <PageLayout fluid withPadding>
      <CheckoutLinksComponent
        apiBasePath={apiBasePath}
        checkoutLinksApiBasePath={checkoutLinksApiBasePath}
      />
    </PageLayout>
  );
}
