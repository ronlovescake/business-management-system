/**
 * Products Module Configuration
 */

import { IconPackage } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const productsModule = createOperationsModuleConfig({
  id: 'clothing-products',
  name: 'Products',
  path: '/clothing/operations/products',
  icon: IconPackage,
  order: 4,
  business: ['clothing'],
});
