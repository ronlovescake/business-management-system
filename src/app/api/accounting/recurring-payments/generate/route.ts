import {
  clothingRecurringPaymentService,
  ClothingRecurringPaymentGenerateSchema,
} from '@/modules/clothing/ledger/recurringPayments/api';
import { createRecurringGenerateRouteHandler } from '@/modules/shared/ledger/recurring-payments/api/routeAdapters';

const handlers = createRecurringGenerateRouteHandler({
  service: clothingRecurringPaymentService,
  schema: ClothingRecurringPaymentGenerateSchema,
  logPrefix: 'clothing',
});

export const POST = handlers.POST;
