/**
 * GM Prices Route Handler
 */

import { PricesRoutePage } from '@/app/operations/prices/_shared/PricesRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function Page() {
  return renderOperationsPage(
    '/general-merchandise/operations/prices',
    <PricesRoutePage apiBasePath="/api/general-merchandise" />
  );
}
