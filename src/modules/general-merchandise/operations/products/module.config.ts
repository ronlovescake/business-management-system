/**
 * GM Products Module Configuration
 */

import { IconPackage } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const generalMerchandiseProductsModule = createOperationsModuleConfig({
  id: 'general-merchandise-products',
  name: 'Products',
  path: '/general-merchandise/operations/products',
  icon: IconPackage,
  order: 4,
  business: ['general-merchandise'],
});
