import { InventoryPage } from '@/modules/clothing/operations/inventory/components/InventoryPage';
import { InventoryErrorBoundary } from '@/app/clothing/operations/inventory/components/InventoryErrorBoundary';

type InventoryRoutePageProps = {
  apiBasePath?: string;
};

export function InventoryRoutePage(props: InventoryRoutePageProps) {
  const { apiBasePath } = props;

  return (
    <InventoryErrorBoundary>
      <InventoryPage apiBasePath={apiBasePath} />
    </InventoryErrorBoundary>
  );
}
