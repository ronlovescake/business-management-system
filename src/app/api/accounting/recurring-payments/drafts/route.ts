import {
  clothingRecurringPaymentService,
  ClothingRecurringPaymentDraftListSchema,
} from '@/modules/clothing/ledger/recurringPayments/api';
import { createRecurringDraftsRouteHandler } from '@/modules/shared/ledger/recurring-payments/api/routeAdapters';

export const dynamic = 'force-dynamic';

const handlers = createRecurringDraftsRouteHandler({
  service: clothingRecurringPaymentService,
  schema: ClothingRecurringPaymentDraftListSchema,
  logPrefix: 'clothing',
});

export const GET = handlers.GET;
