/**
 * GM Inventory Page Route Handler
 */

import { InventoryRoutePage } from '@/app/operations/inventory/_shared/InventoryRoutePage';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function Page() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/inventory',
    <InventoryRoutePage apiBasePath="/api/general-merchandise" />
  );
}
