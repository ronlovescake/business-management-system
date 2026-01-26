import { z } from 'zod';

export const GeneralMerchandiseExpenseStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'paid',
]);

export const GeneralMerchandiseExpenseCategorySchema = z.string().min(1);

export const GeneralMerchandiseExpenseCreateSchema = z.object({
  date: z.date(),
  amount: z.number().finite().positive(),
  description: z.string().trim().min(1),
  category: GeneralMerchandiseExpenseCategorySchema,
  notes: z.string().optional().nullable(),
  receipt: z.string().optional().nullable(),
  status: GeneralMerchandiseExpenseStatusSchema,
  employeeName: z.string().optional().nullable(),
  sourceType: z.string().optional().nullable(),
  sourceId: z.string().optional().nullable(),
  sourceLineKey: z.string().optional().nullable(),
  systemGenerated: z.boolean().optional(),
  paymentMethod: z.string().optional().nullable(),
  paymentCardId: z.string().optional().nullable(),
});

export type GeneralMerchandiseExpenseCreateInput = z.infer<
  typeof GeneralMerchandiseExpenseCreateSchema
>;

export const GeneralMerchandiseExpenseUpdateSchema =
  GeneralMerchandiseExpenseCreateSchema.partial().extend({
    id: z.number().int(),
  });

export type GeneralMerchandiseExpenseUpdateInput = z.infer<
  typeof GeneralMerchandiseExpenseUpdateSchema
>;

export const GeneralMerchandiseExpenseBatchCreateSchema = z.array(
  GeneralMerchandiseExpenseCreateSchema
);

export type GeneralMerchandiseExpenseBatchCreateInput = z.infer<
  typeof GeneralMerchandiseExpenseBatchCreateSchema
>;

export const GeneralMerchandiseExpenseBatchUpdateSchema = z.array(
  GeneralMerchandiseExpenseUpdateSchema
);

export type GeneralMerchandiseExpenseBatchUpdateInput = z.infer<
  typeof GeneralMerchandiseExpenseBatchUpdateSchema
>;

export const GeneralMerchandiseExpenseQuerySchema = z.object({
  category: GeneralMerchandiseExpenseCategorySchema.optional(),
  status: GeneralMerchandiseExpenseStatusSchema.optional(),
  employeeName: z.string().optional(),
  sourceType: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  minAmount: z.number().finite().optional(),
  maxAmount: z.number().finite().optional(),
});

export type GeneralMerchandiseExpenseQuery = z.infer<
  typeof GeneralMerchandiseExpenseQuerySchema
>;

export type GeneralMerchandiseExpenseStatus = z.infer<
  typeof GeneralMerchandiseExpenseStatusSchema
>;

export type GeneralMerchandiseExpenseCategory = z.infer<
  typeof GeneralMerchandiseExpenseCategorySchema
>;

export type GeneralMerchandiseExpenseCreateDbInput = Omit<
  GeneralMerchandiseExpenseCreateInput,
  'date' | 'notes' | 'receipt' | 'employeeName'
> & {
  date: string;
  notes?: string | null;
  receipt?: string | null;
  employeeName?: string | null;
};

export type GeneralMerchandiseExpenseUpdateDbInput = Omit<
  GeneralMerchandiseExpenseUpdateInput,
  'id' | 'date'
> & {
  date?: string;
};
