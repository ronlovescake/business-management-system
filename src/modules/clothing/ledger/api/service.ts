/**
 * Expense Service
 *
 * Business logic layer for expense management
 */

import type { Expense } from '@prisma/client';
import { expenseRepository } from './repository';
import type {
  ExpenseCreateInput,
  ExpenseUpdateInput,
  ExpenseQuery,
} from './schemas';
import { ExpenseServiceBase } from '@/modules/shared/ledger/expenses/api/serviceBase';

export class ExpenseService extends ExpenseServiceBase<
  Expense,
  ExpenseCreateInput,
  ExpenseUpdateInput,
  ExpenseQuery
> {
  constructor() {
    super({
      repository: expenseRepository,
      entityType: 'expense',
      normalizeCreateInput: (data) => {
        const sourceType = (data.sourceType ?? 'MANUAL').toUpperCase();

        const toNullable = (value?: string | null) => {
          if (value === undefined || value === null) {
            return null;
          }
          const trimmed = String(value).trim();
          return trimmed.length === 0 ? null : trimmed;
        };

        const toOptional = (value?: string | null) => {
          if (value === undefined || value === null) {
            return undefined;
          }
          const trimmed = String(value).trim();
          return trimmed.length === 0 ? undefined : trimmed;
        };

        return {
          ...data,
          sourceType,
          sourceId: toNullable(data.sourceId),
          sourceLineKey: toNullable(data.sourceLineKey),
          systemGenerated: data.systemGenerated ?? false,
          paymentMethod: toOptional(data.paymentMethod),
          paymentCardId: toOptional(data.paymentCardId),
          date: data.date.toISOString().split('T')[0],
          receipt: data.receipt ?? undefined,
          notes: data.notes ?? undefined,
          employeeName:
            data.employeeName === undefined ? undefined : data.employeeName,
        };
      },
      normalizeUpdateInput: (data) => {
        const { id: _, ...updateFields } = data;
        const updateData: Record<string, unknown> = { ...updateFields };

        if (updateData.date instanceof Date) {
          updateData.date = updateData.date.toISOString().split('T')[0];
        }

        const toNullable = (value?: string | null) => {
          if (value === undefined || value === null) {
            return null;
          }
          const trimmed = String(value).trim();
          return trimmed.length === 0 ? null : trimmed;
        };

        const toOptional = (value?: string | null) => {
          if (value === undefined || value === null) {
            return undefined;
          }
          const trimmed = String(value).trim();
          return trimmed.length === 0 ? undefined : trimmed;
        };

        if (
          'sourceType' in updateData ||
          'sourceId' in updateData ||
          'sourceLineKey' in updateData ||
          'systemGenerated' in updateData
        ) {
          if ('sourceType' in updateData) {
            updateData.sourceType = String(
              updateData.sourceType ?? 'MANUAL'
            ).toUpperCase();
          }
          if ('sourceId' in updateData) {
            updateData.sourceId = toNullable(
              updateData.sourceId as string | null | undefined
            );
          }
          if ('sourceLineKey' in updateData) {
            updateData.sourceLineKey = toNullable(
              updateData.sourceLineKey as string | null | undefined
            );
          }
          if ('systemGenerated' in updateData) {
            updateData.systemGenerated = Boolean(updateData.systemGenerated);
          }
        }

        if ('paymentMethod' in updateData) {
          updateData.paymentMethod =
            toOptional(updateData.paymentMethod as string | null | undefined) ??
            null;
        }

        if ('paymentCardId' in updateData) {
          updateData.paymentCardId =
            toOptional(updateData.paymentCardId as string | null | undefined) ??
            null;
        }

        return updateData;
      },
    });
  }
}

// Export singleton instance
export const expenseService = new ExpenseService();
