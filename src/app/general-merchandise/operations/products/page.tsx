/**
 * GM Products Page Route Handler
 */

import type { Metadata } from 'next';
import { ProductsPage } from '@/modules/clothing/operations/products/components/ProductsPage';
import { ProductsErrorBoundary } from '@/modules/clothing/operations/products/components/ProductsErrorBoundary';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export const metadata: Metadata = {
  title: 'Products',
};

export default async function Page() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/products',
    <ProductsErrorBoundary>
      <ProductsPage apiBasePath="/api/general-merchandise" />
    </ProductsErrorBoundary>
  );
}
