import {
  createRecurringPaymentService,
  type RecurringPaymentDraftDTO,
  type RecurringPaymentTemplateDTO,
} from './recurringPaymentServiceFactory';

export interface ClothingRecurringPaymentTemplateDTO
  extends RecurringPaymentTemplateDTO {}

export interface ClothingRecurringPaymentDraftDTO
  extends RecurringPaymentDraftDTO<ClothingRecurringPaymentTemplateDTO> {}

export class ClothingRecurringPaymentService extends createRecurringPaymentService<
  ClothingRecurringPaymentTemplateDTO,
  ClothingRecurringPaymentDraftDTO
>({
  templatesEndpoint: '/accounting/recurring-payments/templates',
  draftsEndpoint: '/accounting/recurring-payments/drafts',
  generateEndpoint: '/accounting/recurring-payments/generate',
  approveEndpoint: '/accounting/recurring-payments/drafts/approve',
  skipEndpoint: '/accounting/recurring-payments/drafts/skip',
}) {}
