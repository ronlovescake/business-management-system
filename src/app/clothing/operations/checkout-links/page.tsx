/**
 * Checkout Links Page
 * Manage payment checkout links for customers
 */

import { PageLayout } from '@/components/layout/PageLayout';
import { CheckoutLinksComponent } from '@/modules/clothing/operations/checkout-links/components/CheckoutLinksComponent';

export default function CheckoutLinksPage() {
  return (
    <PageLayout title="Checkout Links">
      <CheckoutLinksComponent />
    </PageLayout>
  );
}
