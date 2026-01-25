import { z } from 'zod';

export const GeneralMerchandiseRecurringPaymentTemplateKindSchema = z.enum([
  'LOAN',
  'EXPENSE',
]);

export const GeneralMerchandiseRecurringPaymentTemplateFrequencySchema = z.enum(
  ['MONTHLY']
);

export const GeneralMerchandiseRecurringPaymentTemplateCreateSchema = z.object({
  name: z.string().trim().min(1),
  kind: GeneralMerchandiseRecurringPaymentTemplateKindSchema,
  amount: z.number().finite().positive(),
  frequency:
    GeneralMerchandiseRecurringPaymentTemplateFrequencySchema.default(
      'MONTHLY'
    ),
  dayOfMonth: z.number().int().min(1).max(31),
  nextDueDate: z.date(),
  endDate: z.date().optional().nullable(),
  debitAccount: z.string().trim().min(1),
  debitTag: z.string().trim().optional().nullable(),
  creditAccount: z.string().trim().min(1),
  creditTag: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type GeneralMerchandiseRecurringPaymentTemplateCreateInput = z.infer<
  typeof GeneralMerchandiseRecurringPaymentTemplateCreateSchema
>;

export const GeneralMerchandiseRecurringPaymentTemplateUpdateSchema =
  GeneralMerchandiseRecurringPaymentTemplateCreateSchema.partial().extend({
    id: z.string().min(1),
  });

export type GeneralMerchandiseRecurringPaymentTemplateUpdateInput = z.infer<
  typeof GeneralMerchandiseRecurringPaymentTemplateUpdateSchema
>;

export const GeneralMerchandiseRecurringPaymentTemplateDeleteSchema = z.object({
  id: z.string().min(1),
});

export type GeneralMerchandiseRecurringPaymentTemplateDeleteInput = z.infer<
  typeof GeneralMerchandiseRecurringPaymentTemplateDeleteSchema
>;

export const GeneralMerchandiseRecurringPaymentDraftStatusSchema = z.enum([
  'DRAFT',
  'APPROVED',
  'SKIPPED',
]);

export const GeneralMerchandiseRecurringPaymentDraftListSchema = z.object({
  status: GeneralMerchandiseRecurringPaymentDraftStatusSchema.optional(),
  dueFrom: z.date().optional(),
  dueTo: z.date().optional(),
  dueOnOrBefore: z.date().optional(),
});

export type GeneralMerchandiseRecurringPaymentDraftListInput = z.infer<
  typeof GeneralMerchandiseRecurringPaymentDraftListSchema
>;

export const GeneralMerchandiseRecurringPaymentGenerateSchema = z.object({
  upToDate: z.date().optional(),
});

export type GeneralMerchandiseRecurringPaymentGenerateInput = z.infer<
  typeof GeneralMerchandiseRecurringPaymentGenerateSchema
>;

export const GeneralMerchandiseRecurringPaymentApproveSchema = z.object({
  draftId: z.string().min(1),
});

export type GeneralMerchandiseRecurringPaymentApproveInput = z.infer<
  typeof GeneralMerchandiseRecurringPaymentApproveSchema
>;

export const GeneralMerchandiseRecurringPaymentSkipSchema = z.object({
  draftId: z.string().min(1),
});

export type GeneralMerchandiseRecurringPaymentSkipInput = z.infer<
  typeof GeneralMerchandiseRecurringPaymentSkipSchema
>;
