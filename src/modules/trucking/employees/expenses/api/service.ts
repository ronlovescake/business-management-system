/**
 * Expense Service
 *
 * Business logic layer for expense management
 */

import type { TruckingExpense } from '@prisma/client';
import { expenseRepository } from './repository';
import type {
  ExpenseCreateInput,
  ExpenseUpdateInput,
  ExpenseQuery,
} from './schemas';
import { ExpenseServiceBase } from '@/modules/shared/ledger/expenses/api/serviceBase';

const normalizeVehicleId = (value?: string | null) => {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toUpperCase() : null;
};

export class ExpenseService extends ExpenseServiceBase<
  TruckingExpense,
  ExpenseCreateInput,
  ExpenseUpdateInput,
  ExpenseQuery
> {
  constructor() {
    super({
      repository: expenseRepository,
      entityType: 'expense',
      normalizeCreateInput: (data) => ({
        ...data,
        date: data.date.toISOString().split('T')[0],
        receipt: data.receipt ?? undefined,
        notes: data.notes ?? undefined,
        employeeName: data.employeeName ?? undefined,
        vehicleId: normalizeVehicleId(data.vehicleId),
      }),
      normalizeUpdateInput: (data) => {
        const { id: _, ...updateFields } = data;
        const updateData: Record<string, unknown> = { ...updateFields };

        if (updateData.date instanceof Date) {
          updateData.date = updateData.date.toISOString().split('T')[0];
        }

        if (Object.prototype.hasOwnProperty.call(updateData, 'vehicleId')) {
          updateData.vehicleId = normalizeVehicleId(
            updateData.vehicleId as string | null | undefined
          );
        }

        return updateData;
      },
      resolveUpdateId: (data) => {
        const id = Number(data.id);
        return Number.isFinite(id) ? id : null;
      },
    });
  }
}

// Export singleton instance
export const expenseService = new ExpenseService();
