/**
 * Expense Repository
 *
 * Data access layer for expenses
 */

import type { Expense } from '@prisma/client';
import { ExpenseRepositoryBase } from '@/modules/shared/ledger/expenses/api/repositoryBase';
import type { ExpenseCreateInput, ExpenseUpdateInput } from './schemas';

export class ExpenseRepository extends ExpenseRepositoryBase<
  Expense,
  ExpenseCreateInput,
  ExpenseUpdateInput
> {
  constructor() {
    super('expense');
  }
}

// Export singleton instance
export const expenseRepository = new ExpenseRepository();
