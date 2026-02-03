/**
 * GM Sorting Distribution Module Configuration
 */

import { IconChartPie } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const generalMerchandiseSortingDistributionModule =
  createOperationsModuleConfig({
    id: 'general-merchandise-sorting-distribution',
    name: 'Sorting Distribution',
    path: '/general-merchandise/operations/sorting-distribution',
    icon: IconChartPie,
    order: 5,
    business: ['general-merchandise'],
  });
