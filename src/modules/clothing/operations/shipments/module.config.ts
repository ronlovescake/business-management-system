/**
 * Shipments Module Configuration
 *
 * Defines the module metadata for the Shipments module.
 */

import { IconAnchor } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const shipmentsModule: ModuleConfig = {
  id: 'clothing-operations-shipments',
  name: 'Shipments',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Shipments',
      path: '/clothing/operations/shipments',
      icon: IconAnchor as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 6, // After Products (4), Sorting Distribution (5)
    },
  ],
};
