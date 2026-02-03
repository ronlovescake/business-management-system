/**
 * GM Inventory Page Route Handler
 */

import { InventoryPage } from '@/modules/clothing/operations/inventory/components/InventoryPage';
import { InventoryErrorBoundary } from '@/app/clothing/operations/inventory/components/InventoryErrorBoundary';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function Page() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/inventory',
    <InventoryErrorBoundary>
      <InventoryPage apiBasePath="/api/general-merchandise" />
    </InventoryErrorBoundary>
  );
}
