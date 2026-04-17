/**
 * GM Inventory Page Route Handler
 */

import { InventoryRoutePage } from '@/app/operations/inventory/_shared/InventoryRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function Page() {
  return renderOperationsPage(
    '/general-merchandise/operations/inventory',
    <InventoryRoutePage apiBasePath="/api/general-merchandise" />
  );
}
