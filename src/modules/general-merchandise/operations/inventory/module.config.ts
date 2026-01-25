/**
 * GM Inventory Module Configuration
 */

import { IconBuildingWarehouse } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const generalMerchandiseInventoryModule: ModuleConfig = {
  id: 'general-merchandise-inventory',
  name: 'Inventory',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Inventory',
      path: '/general-merchandise/operations/inventory',
      icon: IconBuildingWarehouse as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 4.2,
      business: ['general-merchandise'],
      workspace: ['operations'],
    },
  ],

  permissions: ['admin', 'manager', 'operations'],

  metadata: {
    description:
      'Inventory analytics for tracking stock levels, sales, and profitability by product.',
    tags: ['inventory', 'operations', 'stock', 'analytics'],
  },
};
