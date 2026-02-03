/**
 * GM Sorting Distribution Page Route Handler
 */

import { SortingDistributionPage } from '@/modules/clothing/operations/sorting-distribution/components/SortingDistributionPage';
import { SortingDistributionErrorBoundary } from '@/app/clothing/operations/sorting-distribution/components/SortingDistributionErrorBoundary';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function Page() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/sorting-distribution',
    <SortingDistributionErrorBoundary>
      <SortingDistributionPage apiBasePath="/api/general-merchandise" />
    </SortingDistributionErrorBoundary>
  );
}
