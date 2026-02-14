import {
  generalMerchandiseRecurringPaymentService,
  GeneralMerchandiseRecurringPaymentGenerateSchema,
} from '@/modules/general-merchandise/ledger/recurringPayments/api';
import { createRecurringGenerateRouteHandler } from '@/modules/shared/ledger/recurring-payments/api/routeAdapters';

const handlers = createRecurringGenerateRouteHandler({
  service: generalMerchandiseRecurringPaymentService,
  schema: GeneralMerchandiseRecurringPaymentGenerateSchema,
  logPrefix: 'GM',
});

export const POST = handlers.POST;
