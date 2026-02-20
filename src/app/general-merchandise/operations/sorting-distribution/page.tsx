/**
 * GM Sorting Distribution Page Route Handler
 */

'use client';

import { SortingDistributionRoutePage } from '@/app/operations/sorting-distribution/_shared/SortingDistributionRoutePage';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default function Page() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/sorting-distribution',
    <SortingDistributionRoutePage apiBasePath="/api/general-merchandise" />
  );
}
