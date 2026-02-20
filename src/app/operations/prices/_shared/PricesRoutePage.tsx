import { PricesPage } from '@/modules/clothing/operations/prices/components/PricesPage';
import { PricesErrorBoundary } from '@/modules/clothing/operations/prices/components/PricesErrorBoundary';

type PricesRoutePageProps = {
  apiBasePath?: string;
};

export function PricesRoutePage(props: PricesRoutePageProps) {
  const { apiBasePath } = props;

  return (
    <PricesErrorBoundary>
      <PricesPage apiBasePath={apiBasePath} />
    </PricesErrorBoundary>
  );
}
