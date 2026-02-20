'use client';

import { ProfitLossRoutePage } from '@/app/accounting/_shared/ProfitLossRoutePage';

export default function GeneralMerchandiseProfitLossPage() {
  return (
    <ProfitLossRoutePage
      apiBasePath="/api/general-merchandise"
      showBreakdownsTab={false}
    />
  );
}
