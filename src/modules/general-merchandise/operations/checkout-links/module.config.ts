/**
 * GM Checkout Links (Invoicing) Module Configuration
 */

import { IconLink } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const generalMerchandiseCheckoutLinksModule =
  createOperationsModuleConfig({
    id: 'general-merchandise-checkout-links',
    name: 'Invoicing',
    path: '/general-merchandise/operations/checkout-links',
    icon: IconLink,
    order: 8,
    business: ['general-merchandise'],
  });
