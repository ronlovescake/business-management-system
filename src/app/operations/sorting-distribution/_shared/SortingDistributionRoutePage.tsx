'use client';

import dynamic from 'next/dynamic';
import { SortingDistributionErrorBoundary } from '@/app/clothing/operations/sorting-distribution/components/SortingDistributionErrorBoundary';

type SortingDistributionRoutePageProps = {
  apiBasePath?: string;
};

const SortingDistributionPage = dynamic(
  () =>
    import(
      '@/modules/clothing/operations/sorting-distribution/components/SortingDistributionPage'
    ).then((mod) => ({ default: mod.SortingDistributionPage })),
  { ssr: false }
);

export function SortingDistributionRoutePage(
  props: SortingDistributionRoutePageProps
) {
  const { apiBasePath } = props;

  return (
    <SortingDistributionErrorBoundary>
      <SortingDistributionPage apiBasePath={apiBasePath} />
    </SortingDistributionErrorBoundary>
  );
}
