/**
 * GM Sorting Distribution Module Configuration
 */

import { IconChartPie } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const generalMerchandiseSortingDistributionModule: ModuleConfig = {
  id: 'general-merchandise-sorting-distribution',
  name: 'Sorting Distribution',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Sorting Distribution',
      path: '/general-merchandise/operations/sorting-distribution',
      icon: IconChartPie as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 5,
      business: ['general-merchandise'],
      workspace: ['operations'],
    },
  ],
};
