/**
 * Products Module Configuration
 */

import { IconPackage } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const productsModule: ModuleConfig = {
  id: 'clothing-products',
  name: 'Products',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Products',
      path: '/clothing/operations/products',
      icon: IconPackage as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 4, // After Dashboard (0), Customers (2), Prices (3)
    },
  ],
};
