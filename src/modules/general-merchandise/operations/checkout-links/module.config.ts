/**
 * GM Checkout Links (Invoicing) Module Configuration
 */

import { IconLink } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const generalMerchandiseCheckoutLinksModule: ModuleConfig = {
  id: 'general-merchandise-checkout-links',
  name: 'Invoicing',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Invoicing',
      path: '/general-merchandise/operations/checkout-links',
      icon: IconLink as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 8,
      business: ['general-merchandise'],
      workspace: ['operations'],
    },
  ],
};
