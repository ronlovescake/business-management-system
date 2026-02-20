import { ShipmentsPage } from '@/modules/clothing/operations/shipments/components/ShipmentsPage';
import { ShipmentsErrorBoundary } from '@/app/clothing/operations/shipments/components/ShipmentsErrorBoundary';

type ShipmentsRoutePageProps = {
  apiBasePath?: string;
};

export function ShipmentsRoutePage(props: ShipmentsRoutePageProps) {
  const { apiBasePath } = props;

  return (
    <ShipmentsErrorBoundary>
      <ShipmentsPage apiBasePath={apiBasePath} />
    </ShipmentsErrorBoundary>
  );
}
