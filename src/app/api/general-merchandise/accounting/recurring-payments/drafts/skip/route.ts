import {
  generalMerchandiseRecurringPaymentService,
  GeneralMerchandiseRecurringPaymentSkipSchema,
} from '@/modules/general-merchandise/ledger/recurringPayments/api';
import { createRecurringSkipRouteHandler } from '@/modules/shared/ledger/recurring-payments/api/routeAdapters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = createRecurringSkipRouteHandler({
  service: generalMerchandiseRecurringPaymentService,
  schema: GeneralMerchandiseRecurringPaymentSkipSchema,
  logPrefix: 'GM',
});

export const POST = handlers.POST;
