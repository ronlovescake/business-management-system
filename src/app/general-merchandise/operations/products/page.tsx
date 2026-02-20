/**
 * GM Products Page Route Handler
 */

import type { Metadata } from 'next';
import { ProductsRoutePage } from '@/app/operations/products/_shared/ProductsRoutePage';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export const metadata: Metadata = {
  title: 'Products',
};

export default async function Page() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/products',
    <ProductsRoutePage apiBasePath="/api/general-merchandise" />
  );
}
