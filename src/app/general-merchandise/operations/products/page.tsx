/**
 * GM Products Page Route Handler
 */

import type { Metadata } from 'next';
import { ProductsRoutePage } from '@/app/operations/products/_shared/ProductsRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export const metadata: Metadata = {
  title: 'Products',
};

export default async function Page() {
  return renderOperationsPage(
    '/general-merchandise/operations/products',
    <ProductsRoutePage apiBasePath="/api/general-merchandise" />
  );
}
