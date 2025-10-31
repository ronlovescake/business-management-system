/**
 * Dispatch Module Configuration
 *
 * Registers the Dispatch module with the application's module system.
 */

import { IconTruckDelivery } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const dispatchModule: ModuleConfig = {
  id: 'clothing-dispatch',
  name: 'Dispatch',
  version: '1.0.0',
  enabled: true,
  navigation: [
    {
      label: 'Dispatch',
      path: '/clothing/operations/dispatch',
      icon: IconTruckDelivery as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 7, // After Shipments (6)
      business: ['clothing'],
      workspace: ['operations'],
    },
  ],
};
