/**
 * GM Prices Route Handler
 */

import { PricesRoutePage } from '@/app/operations/prices/_shared/PricesRoutePage';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function Page() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/prices',
    <PricesRoutePage apiBasePath="/api/general-merchandise" />
  );
}
