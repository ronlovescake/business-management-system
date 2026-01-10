import type { HouseholdRecurringPayment } from '@prisma/client';
import { BaseRepository } from '@/core/database/repository';
import type { HouseholdRecurringPaymentCreateInput } from './schemas';

export type HouseholdRecurringPaymentUpdateInput =
  Partial<HouseholdRecurringPaymentCreateInput> & {
    id: string;
  };

export class HouseholdRecurringPaymentRepository extends BaseRepository<
  HouseholdRecurringPayment,
  HouseholdRecurringPaymentCreateInput,
  HouseholdRecurringPaymentUpdateInput
> {
  protected readonly modelName = 'householdRecurringPayment';
}

export const householdRecurringPaymentRepository =
  new HouseholdRecurringPaymentRepository();
