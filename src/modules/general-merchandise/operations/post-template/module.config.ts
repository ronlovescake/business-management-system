/**
 * GM Post Template Module Configuration
 */

import { IconTemplate } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const generalMerchandisePostTemplateModule: ModuleConfig = {
  id: 'general-merchandise-post-template',
  name: 'Post Template',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Post Template',
      path: '/general-merchandise/operations/post-template',
      icon: IconTemplate as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 9,
      business: ['general-merchandise'],
      workspace: ['operations'],
    },
  ],
};
