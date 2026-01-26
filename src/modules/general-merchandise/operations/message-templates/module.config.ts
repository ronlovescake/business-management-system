/**
 * GM Message Templates Module Configuration
 */

import { IconMessage } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const generalMerchandiseMessageTemplatesModule: ModuleConfig = {
  id: 'general-merchandise-message-templates',
  name: 'Message Templates',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Message Templates',
      path: '/general-merchandise/operations/message-templates',
      icon: IconMessage as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 9.5,
      business: ['general-merchandise'],
      workspace: ['operations'],
    },
  ],
};
