import {
  clothingRecurringPaymentService,
  ClothingRecurringPaymentApproveSchema,
} from '@/modules/clothing/ledger/recurringPayments/api';
import { createRecurringApproveRouteHandler } from '@/modules/shared/ledger/recurring-payments/api/routeAdapters';

const handlers = createRecurringApproveRouteHandler({
  service: clothingRecurringPaymentService,
  schema: ClothingRecurringPaymentApproveSchema,
  logPrefix: 'clothing',
});

export const POST = handlers.POST;
