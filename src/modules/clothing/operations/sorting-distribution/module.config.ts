/**
 * Sorting Distribution Module Configuration
 *
 * Registers the Sorting Distribution module with the application's module system.
 */

import { IconSortDescending } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const sortingDistributionModule: ModuleConfig = {
  id: 'clothing-sorting-distribution',
  name: 'Sorting Distribution',
  version: '1.0.0',
  enabled: true,
  navigation: [
    {
      label: 'Sorting Distribution',
      path: '/clothing/operations/sorting-distribution',
      icon: IconSortDescending as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 5, // After Dashboard (1), Customers (2), Prices (3), Products (4)
    },
  ],
};
