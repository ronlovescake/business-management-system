'use client';

import { AccountingDashboardRoutePage } from '@/app/accounting/_shared/AccountingDashboardRoutePage';

export default function GeneralMerchandiseAccountingDashboardPage() {
  return (
    <AccountingDashboardRoutePage
      businessPathPrefix="/general-merchandise"
      apiBasePath="/api/general-merchandise"
    />
  );
}
