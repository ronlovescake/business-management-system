/**
 * Inventory Module Configuration
 *
 * Registers the clothing operations inventory workspace page with module registry.
 */

import { IconBuildingWarehouse } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const inventoryModule: ModuleConfig = {
  id: 'clothing-inventory',
  name: 'Inventory',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Inventory',
      path: '/clothing/operations/inventory',
      icon: IconBuildingWarehouse as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 4.2, // After Products (4) and before Sorting Distribution (5)
      business: ['clothing'],
      workspace: ['operations'],
    },
  ],

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
};
