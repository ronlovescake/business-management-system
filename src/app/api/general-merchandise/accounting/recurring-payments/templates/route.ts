import {
  generalMerchandiseRecurringPaymentService,
  GeneralMerchandiseRecurringPaymentTemplateCreateSchema,
  GeneralMerchandiseRecurringPaymentTemplateUpdateSchema,
  GeneralMerchandiseRecurringPaymentTemplateDeleteSchema,
} from '@/modules/general-merchandise/ledger/recurringPayments/api';
import { createRecurringTemplatesRouteHandlers } from '@/modules/shared/ledger/recurring-payments/api/routeAdapters';

const handlers = createRecurringTemplatesRouteHandlers({
  service: generalMerchandiseRecurringPaymentService,
  createSchema: GeneralMerchandiseRecurringPaymentTemplateCreateSchema,
  updateSchema: GeneralMerchandiseRecurringPaymentTemplateUpdateSchema,
  deleteSchema: GeneralMerchandiseRecurringPaymentTemplateDeleteSchema,
  logPrefix: 'GM',
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
