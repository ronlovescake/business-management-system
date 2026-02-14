import {
  generalMerchandiseRecurringPaymentService,
  GeneralMerchandiseRecurringPaymentApproveSchema,
} from '@/modules/general-merchandise/ledger/recurringPayments/api';
import { createRecurringApproveRouteHandler } from '@/modules/shared/ledger/recurring-payments/api/routeAdapters';

const handlers = createRecurringApproveRouteHandler({
  service: generalMerchandiseRecurringPaymentService,
  schema: GeneralMerchandiseRecurringPaymentApproveSchema,
  logPrefix: 'GM',
});

export const POST = handlers.POST;
