/**
 * GM Prices Route Handler
 */

import { PricesPage } from '@/modules/clothing/operations/prices/components/PricesPage';
import { PricesErrorBoundary } from '@/modules/clothing/operations/prices/components/PricesErrorBoundary';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function Page() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/prices',
    <PricesErrorBoundary>
      <PricesPage apiBasePath="/api/general-merchandise" />
    </PricesErrorBoundary>
  );
}
