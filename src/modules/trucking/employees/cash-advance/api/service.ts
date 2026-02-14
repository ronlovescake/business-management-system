/**
 * Cash Advance Service
 *
 * Business logic layer for cash advance management
 */

import type { TruckingCashAdvanceRecord } from '@prisma/client';
import { CashAdvanceServiceBase } from '@/modules/shared/employees/cash-advance/api/serviceBase';
import { cashAdvanceRepository } from './repository';
import type {
  CashAdvanceCreateInput,
  CashAdvanceUpdateInput,
  CashAdvanceQuery,
} from './schemas';

/**
 * Service class for cash advance operations
 */
export class CashAdvanceService extends CashAdvanceServiceBase<
  TruckingCashAdvanceRecord,
  CashAdvanceCreateInput,
  CashAdvanceUpdateInput,
  CashAdvanceQuery
> {
  constructor() {
    super(cashAdvanceRepository);
  }
}

// Singleton instance
export const cashAdvanceService = new CashAdvanceService();
