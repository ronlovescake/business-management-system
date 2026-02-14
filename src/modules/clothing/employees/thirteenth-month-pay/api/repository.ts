/**
 * Thirteenth Month Pay Repository
 *
 * Data access layer for 13th month pay operations
 */

import type { ThirteenthMonthPayRecord, Prisma } from '@prisma/client';
import { ThirteenthMonthPayRepositoryBase } from '@/modules/shared/employees/thirteenth-month-pay/api/repositoryBase';

/**
 * Repository for ThirteenthMonthPayRecord entity
 */
export class ThirteenthMonthPayRepository extends ThirteenthMonthPayRepositoryBase<
  ThirteenthMonthPayRecord,
  Prisma.ThirteenthMonthPayRecordCreateInput,
  Prisma.ThirteenthMonthPayRecordUpdateInput
> {
  constructor() {
    super('thirteenthMonthPayRecord');
  }
}

// Singleton instance
export const thirteenthMonthPayRepository = new ThirteenthMonthPayRepository();
