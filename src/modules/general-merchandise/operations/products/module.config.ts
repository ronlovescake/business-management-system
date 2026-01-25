/**
 * GM Products Module Configuration
 */

import { IconPackage } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const generalMerchandiseProductsModule: ModuleConfig = {
  id: 'general-merchandise-products',
  name: 'Products',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Products',
      path: '/general-merchandise/operations/products',
      icon: IconPackage as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 4,
      business: ['general-merchandise'],
      workspace: ['operations'],
    },
  ],
};
