import {
  createRecurringPaymentService,
  type RecurringPaymentDraftDTO,
  type RecurringPaymentTemplateDTO,
} from './recurringPaymentServiceFactory';

export interface GeneralMerchandiseRecurringPaymentTemplateDTO
  extends RecurringPaymentTemplateDTO {}

export interface GeneralMerchandiseRecurringPaymentDraftDTO
  extends RecurringPaymentDraftDTO<GeneralMerchandiseRecurringPaymentTemplateDTO> {}

export class GeneralMerchandiseRecurringPaymentService extends createRecurringPaymentService<
  GeneralMerchandiseRecurringPaymentTemplateDTO,
  GeneralMerchandiseRecurringPaymentDraftDTO
>({
  templatesEndpoint:
    '/general-merchandise/accounting/recurring-payments/templates',
  draftsEndpoint: '/general-merchandise/accounting/recurring-payments/drafts',
  generateEndpoint: '/general-merchandise/accounting/recurring-payments/generate',
  approveEndpoint:
    '/general-merchandise/accounting/recurring-payments/drafts/approve',
  skipEndpoint:
    '/general-merchandise/accounting/recurring-payments/drafts/skip',
}) {}
