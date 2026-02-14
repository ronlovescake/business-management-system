import {
  clothingRecurringPaymentService,
  ClothingRecurringPaymentTemplateCreateSchema,
  ClothingRecurringPaymentTemplateUpdateSchema,
  ClothingRecurringPaymentTemplateDeleteSchema,
} from '@/modules/clothing/ledger/recurringPayments/api';
import { createRecurringTemplatesRouteHandlers } from '@/modules/shared/ledger/recurring-payments/api/routeAdapters';

const handlers = createRecurringTemplatesRouteHandlers({
  service: clothingRecurringPaymentService,
  createSchema: ClothingRecurringPaymentTemplateCreateSchema,
  updateSchema: ClothingRecurringPaymentTemplateUpdateSchema,
  deleteSchema: ClothingRecurringPaymentTemplateDeleteSchema,
  logPrefix: 'clothing',
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
