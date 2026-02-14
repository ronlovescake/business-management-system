import {
  generalMerchandiseRecurringPaymentService,
  GeneralMerchandiseRecurringPaymentDraftListSchema,
} from '@/modules/general-merchandise/ledger/recurringPayments/api';
import { createRecurringDraftsRouteHandler } from '@/modules/shared/ledger/recurring-payments/api/routeAdapters';

export const dynamic = 'force-dynamic';

const handlers = createRecurringDraftsRouteHandler({
  service: generalMerchandiseRecurringPaymentService,
  schema: GeneralMerchandiseRecurringPaymentDraftListSchema,
  logPrefix: 'GM',
});

export const GET = handlers.GET;
