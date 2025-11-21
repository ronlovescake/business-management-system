import type { PostTemplateNotice } from './notice.types';

export const DEFAULT_POST_TEMPLATE_NOTICE: PostTemplateNotice = {
  id: 'post-template-notice',
  introParagraphs: [
    "Please be aware that the specified 'age range', such as 0-24 months, may not include all subcategories (0-3, 3-6, 6-9, 9-12, 12-18, and 18-24 months). It's common for one or more of these specific size ranges to be missing from the assortment.",
    "Therefore, we refer to these as 'broken sizes.'",
  ],
  bulletPoints: [
    'Shopee Delivery Name',
    'Contact Number',
    'Shipping Address',
    'Email Address',
  ],
};
