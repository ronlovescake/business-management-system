/**
 * Inventory Page Route
 * Renders the clothing operations inventory workspace using the reusable table template.
 */

import { InventoryRoutePage } from '@/app/operations/inventory/_shared/InventoryRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function InventoryRoute() {
  return renderOperationsPage(
    '/clothing/operations/inventory',
    <InventoryRoutePage />
  );
}
