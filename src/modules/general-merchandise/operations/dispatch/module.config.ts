/**
 * GM Dispatch Module Configuration
 */

import { IconTruckDelivery } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const generalMerchandiseDispatchModule: ModuleConfig = {
  id: 'general-merchandise-dispatch',
  name: 'Dispatch',
  version: '1.0.0',
  enabled: true,
  navigation: [
    {
      label: 'Dispatch',
      path: '/general-merchandise/operations/dispatch',
      icon: IconTruckDelivery as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 7,
      business: ['general-merchandise'],
      workspace: ['operations'],
    },
  ],
};
