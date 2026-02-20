/**
 * Checkout Links Page
 * Manage payment checkout links for customers
 */

import { CheckoutLinksRoutePage } from '@/app/operations/checkout-links/_shared/CheckoutLinksRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function CheckoutLinksPage() {
  return renderOperationsPage(
    '/clothing/operations/checkout-links',
    <CheckoutLinksRoutePage />
  );
}
