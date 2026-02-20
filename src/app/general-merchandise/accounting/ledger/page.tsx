'use client';

import { LedgerRoutePage } from '@/app/accounting/_shared/LedgerRoutePage';
import { GeneralMerchandiseRecurringPaymentService } from '@/services/GeneralMerchandiseRecurringPaymentService';

export default function GeneralMerchandiseLedgerPage() {
  return (
    <LedgerRoutePage
      apiBasePath="/api/general-merchandise"
      recurringPaymentService={GeneralMerchandiseRecurringPaymentService}
    />
  );
}
