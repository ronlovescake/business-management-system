import { InventoryPage } from '@/modules/clothing/operations/inventory/components/InventoryPage';
import { InventoryErrorBoundary } from '@/app/clothing/operations/inventory/components/InventoryErrorBoundary';

type InventoryRoutePageProps = {
  apiBasePath?: string;
  supportsSplitBatches?: boolean;
};

export function InventoryRoutePage(props: InventoryRoutePageProps) {
  const { apiBasePath, supportsSplitBatches } = props;

  return (
    <InventoryErrorBoundary>
      <InventoryPage
        apiBasePath={apiBasePath}
        supportsSplitBatches={supportsSplitBatches}
      />
    </InventoryErrorBoundary>
  );
}
