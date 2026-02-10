/**
 * GM Sorting Distribution Page Route Handler
 */

'use client';

import dynamic from 'next/dynamic';
import { SortingDistributionErrorBoundary } from '@/app/clothing/operations/sorting-distribution/components/SortingDistributionErrorBoundary';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

const SortingDistributionPage = dynamic(
  () =>
    import(
      '@/modules/clothing/operations/sorting-distribution/components/SortingDistributionPage'
    ).then((mod) => ({ default: mod.SortingDistributionPage })),
  { ssr: false }
);

export default function Page() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/sorting-distribution',
    <SortingDistributionErrorBoundary>
      <SortingDistributionPage apiBasePath="/api/general-merchandise" />
    </SortingDistributionErrorBoundary>
  );
}
