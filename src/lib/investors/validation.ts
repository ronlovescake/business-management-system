import { z } from 'zod';
import { isCalendarDate } from './schedule';

const date = z.string().refine(isCalendarDate, 'Enter a valid calendar date');
const text = (length: number) => z.string().trim().max(length).default('');

export const investorInput = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.union([z.string().email().max(255), z.literal('')]).default(''),
  phone: text(100),
  address: text(1000),
  bankName: text(255),
  accountName: text(255),
  accountNumber: text(100),
  notes: text(2000),
});

export const agreementInput = z.object({
  investorId: z.string().min(1).max(100),
  reference: z.string().trim().min(1).max(100),
  effectiveDate: date,
  principal: z
    .string()
    .regex(
      /^\d{1,12}(\.\d{1,2})?$/,
      'Enter a positive amount with at most two decimal places'
    )
    .refine(
      (value) => Number(value) > 0,
      'Investment must be greater than zero'
    ),
  monthlyRateBps: z.number().int().min(1).max(10000).default(500),
  notes: text(2000),
});

export const closureInput = z.object({
  date,
  name: z.string().trim().min(1).max(255),
});

export const paymentInput = z.object({
  agreementId: z.string().min(1).max(100),
  month: z.number().int().min(1).max(36),
  amount: z
    .string()
    .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Enter a valid payment amount')
    .refine((value) => Number(value) > 0, 'Payment must be greater than zero'),
  paidDate: date,
});

export const investorMutation = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('investor'),
    id: z.string().min(1).optional(),
    data: investorInput,
  }),
  z.object({
    kind: z.literal('agreement'),
    id: z.string().min(1).optional(),
    data: agreementInput,
  }),
  z.object({ kind: z.literal('closure'), data: closureInput }),
  z.object({ kind: z.literal('payment'), data: paymentInput }),
  z.object({
    kind: z.literal('funding'),
    data: z.object({ agreementId: z.string().min(1).max(100), date }),
  }),
  z.object({
    kind: z.literal('repayment'),
    data: z.object({ agreementId: z.string().min(1).max(100), date }),
  }),
]);

export type InvestorInput = z.infer<typeof investorInput>;
export type AgreementInput = z.infer<typeof agreementInput>;
