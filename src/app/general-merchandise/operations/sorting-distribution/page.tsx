/**
 * GM Sorting Distribution Page Route Handler
 */

'use client';

import { SortingDistributionRoutePage } from '@/app/operations/sorting-distribution/_shared/SortingDistributionRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default function Page() {
  return renderOperationsPage(
    '/general-merchandise/operations/sorting-distribution',
    <SortingDistributionRoutePage apiBasePath="/api/general-merchandise" />
  );
}
