/**
 * Thirteenth Month Pay Service
 *
 * Business logic layer for 13th month pay management
 */

import type { ThirteenthMonthPayRecord } from '@prisma/client';
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
  ThirteenthMonthPayRecord,
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
