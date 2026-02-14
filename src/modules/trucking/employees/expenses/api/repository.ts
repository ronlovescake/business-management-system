/**
 * Expense Repository
 *
 * Data access layer for expenses
 */

import type { TruckingExpense } from '@prisma/client';
import { ExpenseRepositoryBase } from '@/modules/shared/ledger/expenses/api/repositoryBase';
import type { ExpenseCreateInput, ExpenseUpdateInput } from './schemas';

export class ExpenseRepository extends ExpenseRepositoryBase<
  TruckingExpense,
  ExpenseCreateInput,
  ExpenseUpdateInput
> {
  constructor() {
    super('truckingExpense');
  }
}

// Export singleton instance
export const expenseRepository = new ExpenseRepository();
