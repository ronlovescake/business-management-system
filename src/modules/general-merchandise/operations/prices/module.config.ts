/**
 * GM Prices Module Configuration
 */

import { IconTag } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const generalMerchandisePricesModule: ModuleConfig = {
  id: 'general-merchandise-prices',
  name: 'Prices',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Prices',
      path: '/general-merchandise/operations/prices',
      icon: IconTag as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 3,
      business: ['general-merchandise'],
      workspace: ['operations'],
    },
  ],
};
