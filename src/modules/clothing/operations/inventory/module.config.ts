/**
 * Inventory Module Configuration
 *
 * Registers the clothing operations inventory workspace page with module registry.
 */

import { IconBuildingWarehouse } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const inventoryModule = createOperationsModuleConfig({
  id: 'clothing-inventory',
  name: 'Inventory',
  path: '/clothing/operations/inventory',
  icon: IconBuildingWarehouse,
  order: 4.2,
  business: ['clothing'],
  routes: [
    {
      path: '/clothing/operations/inventory',
      component: async () => {
        const { InventoryPage } = await import('./components/InventoryPage');
        return { default: InventoryPage };
      },
      protected: true,
    },
  ],
  permissions: ['admin', 'manager', 'operations'],
  metadata: {
    description:
      'Inventory analytics for tracking stock levels, sales, and profitability by product.',
    tags: ['inventory', 'operations', 'stock', 'analytics'],
  },
});
