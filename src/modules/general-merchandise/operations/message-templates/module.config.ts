/**
 * GM Message Templates Module Configuration
 */

import { IconMessage } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const generalMerchandiseMessageTemplatesModule =
  createOperationsModuleConfig({
    id: 'general-merchandise-message-templates',
    name: 'Message Templates',
    path: '/general-merchandise/operations/message-templates',
    icon: IconMessage,
    order: 9.5,
    business: ['general-merchandise'],
  });
