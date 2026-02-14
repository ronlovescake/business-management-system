import {
  clothingRecurringPaymentService,
  ClothingRecurringPaymentSkipSchema,
} from '@/modules/clothing/ledger/recurringPayments/api';
import { createRecurringSkipRouteHandler } from '@/modules/shared/ledger/recurring-payments/api/routeAdapters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = createRecurringSkipRouteHandler({
  service: clothingRecurringPaymentService,
  schema: ClothingRecurringPaymentSkipSchema,
  logPrefix: 'clothing',
});

export const POST = handlers.POST;
