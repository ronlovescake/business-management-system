/**
 * Cash Advance Repository
 *
 * Data access layer for cash advance operations
 */

import type { CashAdvanceRecord, Prisma } from '@prisma/client';
import { CashAdvanceRepositoryBase } from '@/modules/shared/employees/cash-advance/api/repositoryBase';

/**
 * Repository for CashAdvanceRecord entity
 */
export class CashAdvanceRepository extends CashAdvanceRepositoryBase<
  CashAdvanceRecord,
  Prisma.CashAdvanceRecordCreateInput,
  Prisma.CashAdvanceRecordUpdateInput
> {
  constructor() {
    super('cashAdvanceRecord');
  }
}

// Singleton instance
export const cashAdvanceRepository = new CashAdvanceRepository();
