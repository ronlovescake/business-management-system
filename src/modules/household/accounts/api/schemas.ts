import { z } from 'zod';

export const HouseholdAccountTypeSchema = z.enum([
  'CASH',
  'BANK',
  'EWALLET',
  'CREDIT_CARD',
  'LOAN',
]);
export type HouseholdAccountType = z.infer<typeof HouseholdAccountTypeSchema>;

const OptionalText = z
  .string()
  .trim()
  .transform((val) => (val === '' ? null : val))
  .nullable()
  .optional();

export const HouseholdAccountCreateSchema = z.object({
  name: z.string().trim().min(1, 'Account name is required').max(255),
  type: HouseholdAccountTypeSchema,
  institution: OptionalText,
  accountNumberLast4: z
    .string()
    .trim()
    .max(10, 'Last 4 must be 10 characters or less')
    .transform((val) => (val === '' ? null : val))
    .nullable()
    .optional(),
  isActive: z.boolean().optional().default(true),
  balance: z.number().finite().optional().default(0),
});

export type HouseholdAccountCreateInput = z.infer<
  typeof HouseholdAccountCreateSchema
>;

export type HouseholdAccountCreateDbInput = Omit<
  HouseholdAccountCreateInput,
  'institution' | 'accountNumberLast4'
> & {
  institution?: string;
  accountNumberLast4?: string;
};

export const HouseholdAccountUpdateSchema =
  HouseholdAccountCreateSchema.partial().extend({
    id: z.string().min(1),
  });

export type HouseholdAccountUpdateInput = z.infer<
  typeof HouseholdAccountUpdateSchema
>;

export const HouseholdAccountBatchCreateSchema = z
  .array(HouseholdAccountCreateSchema)
  .max(10000, 'Maximum 10,000 accounts per batch');

export const HouseholdAccountQuerySchema = z.object({
  type: HouseholdAccountTypeSchema.optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) {
        return undefined;
      }
      if (val.toLowerCase() === 'true') {
        return true;
      }
      if (val.toLowerCase() === 'false') {
        return false;
      }
      return undefined;
    }),
  institution: z.string().trim().max(255).optional(),
  search: z.string().trim().max(255).optional(),
});

export type HouseholdAccountQuery = z.infer<typeof HouseholdAccountQuerySchema>;
