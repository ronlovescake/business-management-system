/**
 * Sorting Distribution Module Configuration
 *
 * Registers the Sorting Distribution module with the application's module system.
 */

import { IconSortDescending } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const sortingDistributionModule = createOperationsModuleConfig({
  id: 'clothing-sorting-distribution',
  name: 'Sorting Distribution',
  path: '/clothing/operations/sorting-distribution',
  icon: IconSortDescending,
  order: 5,
  business: ['clothing'],
});
