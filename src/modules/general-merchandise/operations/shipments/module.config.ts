/**
 * GM Shipments Module Configuration
 */

import { IconAnchor } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const generalMerchandiseShipmentsModule: ModuleConfig = {
  id: 'general-merchandise-operations-shipments',
  name: 'Shipments',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Shipments',
      path: '/general-merchandise/operations/shipments',
      icon: IconAnchor as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 6,
      business: ['general-merchandise'],
      workspace: ['operations'],
    },
  ],
};
