/**
 * GM Prices Module Configuration
 */

import { IconTag } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const generalMerchandisePricesModule = createOperationsModuleConfig({
  id: 'general-merchandise-prices',
  name: 'Prices',
  path: '/general-merchandise/operations/prices',
  icon: IconTag,
  order: 3,
  business: ['general-merchandise'],
});
