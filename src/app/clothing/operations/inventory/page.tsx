/**
 * Inventory Page Route
 * Renders the clothing operations inventory workspace using the reusable table template.
 */

import { PageLayout } from '@/components/layout/PageLayout';
import { InventoryPage } from '@/modules/clothing/operations/inventory';

export default function InventoryRoute() {
  return (
    <PageLayout fluid withPadding>
      <InventoryPage />
    </PageLayout>
  );
}
