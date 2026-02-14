/**
 * Thirteenth Month Pay Repository
 *
 * Data access layer for 13th month pay operations
 */

import type { Prisma, TruckingThirteenthMonthPayRecord } from '@prisma/client';
import { ThirteenthMonthPayRepositoryBase } from '@/modules/shared/employees/thirteenth-month-pay/api/repositoryBase';

/**
 * Repository for ThirteenthMonthPayRecord entity
 */
export class ThirteenthMonthPayRepository extends ThirteenthMonthPayRepositoryBase<
  TruckingThirteenthMonthPayRecord,
  Prisma.TruckingThirteenthMonthPayRecordCreateInput,
  Prisma.TruckingThirteenthMonthPayRecordUpdateInput
> {
  constructor() {
    super('truckingThirteenthMonthPayRecord');
  }
}

// Singleton instance
export const thirteenthMonthPayRepository = new ThirteenthMonthPayRepository();
