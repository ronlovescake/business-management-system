/**
 * GM Inventory Module Configuration
 */

import { IconBuildingWarehouse } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const generalMerchandiseInventoryModule = createOperationsModuleConfig({
  id: 'general-merchandise-inventory',
  name: 'Inventory',
  path: '/general-merchandise/operations/inventory',
  icon: IconBuildingWarehouse,
  order: 4.2,
  business: ['general-merchandise'],
  permissions: ['admin', 'manager', 'operations'],
  metadata: {
    description:
      'Inventory analytics for tracking stock levels, sales, and profitability by product.',
    tags: ['inventory', 'operations', 'stock', 'analytics'],
  },
});
