/**
 * Due Dates Module Configuration
 *
 * This module shows customers with unpaid invoices (Order Status = "Prepared")
 * grouped by customer with invoice dates and line totals.
 */

import { IconCalendarDue } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const dueDatesModule = createOperationsModuleConfig({
  id: 'clothing-due-dates',
  name: 'Due Dates',
  path: '/clothing/operations/due-dates',
  icon: IconCalendarDue,
  order: 3,
  business: ['clothing'],
  routes: [
    {
      path: '/clothing/operations/due-dates',
      component: async () => {
        const { DueDatesPage } = await import('./components/DueDatesPage');
        return { default: DueDatesPage };
      },
      protected: true,
    },
  ],
  permissions: ['admin', 'manager', 'operations'],
  metadata: {
    description:
      'Track customers with unpaid invoices, view due dates, and contact buyers',
    author: 'Business Management System',
    tags: ['operations', 'invoices', 'due-dates', 'payments'],
  },
});
