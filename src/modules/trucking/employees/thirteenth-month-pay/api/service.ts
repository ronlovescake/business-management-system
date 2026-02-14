/**
 * Thirteenth Month Pay Service
 *
 * Business logic layer for 13th month pay management
 *
 * Note: This file contains 'as any' type assertions due to incompatibility between
 * BaseRepository's generic types and Prisma's strict input types. This is an
 * architectural limitation that would require refactoring BaseRepository to resolve.
 * The eslint warnings are accepted as unavoidable in this context.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { TruckingThirteenthMonthPayRecord } from '@prisma/client';
import { ThirteenthMonthPayServiceBase } from '@/modules/shared/employees/thirteenth-month-pay/api/serviceBase';
import { thirteenthMonthPayRepository } from './repository';
import type {
  ThirteenthMonthPayCreateInput,
  ThirteenthMonthPayUpdateInput,
  ThirteenthMonthPayQuery,
} from './schemas';

/**
 * Service class for 13th month pay operations
 */
export class ThirteenthMonthPayService extends ThirteenthMonthPayServiceBase<
  TruckingThirteenthMonthPayRecord,
  ThirteenthMonthPayCreateInput,
  ThirteenthMonthPayUpdateInput,
  ThirteenthMonthPayQuery
> {
  constructor() {
    super(thirteenthMonthPayRepository);
  }
}

// Singleton instance
export const thirteenthMonthPayService = new ThirteenthMonthPayService();
