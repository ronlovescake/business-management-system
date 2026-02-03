/**
 * GM Post Template Module Configuration
 */

import { IconTemplate } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const generalMerchandisePostTemplateModule =
  createOperationsModuleConfig({
    id: 'general-merchandise-post-template',
    name: 'Post Template',
    path: '/general-merchandise/operations/post-template',
    icon: IconTemplate,
    order: 9,
    business: ['general-merchandise'],
  });
