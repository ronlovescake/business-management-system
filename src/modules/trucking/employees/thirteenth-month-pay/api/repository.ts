/**
 * Thirteenth Month Pay Repository
 *
 * Data access layer for 13th month pay operations
 *
 * Note: This file contains 'as any' type assertions due to incompatibility between
 * BaseRepository's generic types and Prisma's strict where clause types. This is an
 * architectural limitation that would require refactoring BaseRepository to resolve.
 * The eslint warnings are accepted as unavoidable in this context.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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
