import { z } from 'zod';

export const ClothingRecurringPaymentTemplateKindSchema = z.enum([
  'LOAN',
  'EXPENSE',
]);

export const ClothingRecurringPaymentTemplateFrequencySchema = z.enum([
  'MONTHLY',
]);

export const ClothingRecurringPaymentTemplateCreateSchema = z.object({
  name: z.string().trim().min(1),
  kind: ClothingRecurringPaymentTemplateKindSchema,
  amount: z.number().finite().positive(),
  frequency: ClothingRecurringPaymentTemplateFrequencySchema.default('MONTHLY'),
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

export type ClothingRecurringPaymentTemplateCreateInput = z.infer<
  typeof ClothingRecurringPaymentTemplateCreateSchema
>;

export const ClothingRecurringPaymentTemplateUpdateSchema =
  ClothingRecurringPaymentTemplateCreateSchema.partial().extend({
    id: z.string().min(1),
  });

export type ClothingRecurringPaymentTemplateUpdateInput = z.infer<
  typeof ClothingRecurringPaymentTemplateUpdateSchema
>;

export const ClothingRecurringPaymentTemplateDeleteSchema = z.object({
  id: z.string().min(1),
});

export type ClothingRecurringPaymentTemplateDeleteInput = z.infer<
  typeof ClothingRecurringPaymentTemplateDeleteSchema
>;

export const ClothingRecurringPaymentDraftStatusSchema = z.enum([
  'DRAFT',
  'APPROVED',
  'SKIPPED',
]);

export const ClothingRecurringPaymentDraftListSchema = z.object({
  status: ClothingRecurringPaymentDraftStatusSchema.optional(),
  dueFrom: z.date().optional(),
  dueTo: z.date().optional(),
  dueOnOrBefore: z.date().optional(),
});

export type ClothingRecurringPaymentDraftListInput = z.infer<
  typeof ClothingRecurringPaymentDraftListSchema
>;

export const ClothingRecurringPaymentGenerateSchema = z.object({
  upToDate: z.date().optional(),
});

export type ClothingRecurringPaymentGenerateInput = z.infer<
  typeof ClothingRecurringPaymentGenerateSchema
>;

export const ClothingRecurringPaymentApproveSchema = z.object({
  draftId: z.string().min(1),
});

export type ClothingRecurringPaymentApproveInput = z.infer<
  typeof ClothingRecurringPaymentApproveSchema
>;

export const ClothingRecurringPaymentSkipSchema = z.object({
  draftId: z.string().min(1),
});

export type ClothingRecurringPaymentSkipInput = z.infer<
  typeof ClothingRecurringPaymentSkipSchema
>;
