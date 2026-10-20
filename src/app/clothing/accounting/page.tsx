'use client';

import { AccountingDashboardRoutePage } from '@/app/accounting/_shared/AccountingDashboardRoutePage';

export default function ClothingAccountingDashboardPage() {
  return (
    <AccountingDashboardRoutePage
      businessPathPrefix="/clothing"
      showExpensesLink
      showInvestorsLink
    />
  );
}
