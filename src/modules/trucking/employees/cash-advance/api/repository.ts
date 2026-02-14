/**
 * Cash Advance Repository
 *
 * Data access layer for cash advance operations
 */

import type { Prisma, TruckingCashAdvanceRecord } from '@prisma/client';
import { CashAdvanceRepositoryBase } from '@/modules/shared/employees/cash-advance/api/repositoryBase';

/**
 * Repository for CashAdvanceRecord entity
 */
export class CashAdvanceRepository extends CashAdvanceRepositoryBase<
  TruckingCashAdvanceRecord,
  Prisma.TruckingCashAdvanceRecordCreateInput,
  Prisma.TruckingCashAdvanceRecordUpdateInput
> {
  constructor() {
    super('truckingCashAdvanceRecord');
  }
}

// Singleton instance
export const cashAdvanceRepository = new CashAdvanceRepository();
