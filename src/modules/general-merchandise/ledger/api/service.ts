import { logger } from '@/lib/logger';
import {
  generalMerchandiseExpenseRepository,
  type GeneralMerchandiseExpenseEntity,
} from './repository';
import type {
  GeneralMerchandiseExpenseCreateInput,
  GeneralMerchandiseExpenseUpdateInput,
  GeneralMerchandiseExpenseQuery,
} from './schemas';
import { ExpenseServiceBase } from '@/modules/shared/ledger/expenses/api/serviceBase';

export class GeneralMerchandiseExpenseService extends ExpenseServiceBase<
  GeneralMerchandiseExpenseEntity,
  GeneralMerchandiseExpenseCreateInput,
  GeneralMerchandiseExpenseUpdateInput,
  GeneralMerchandiseExpenseQuery
> {
  constructor() {
    super({
      repository: generalMerchandiseExpenseRepository,
      entityType: 'general_merchandise_expense',
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
        const updateData: Omit<GeneralMerchandiseExpenseUpdateInput, 'id'> & {
          date?: Date | string;
        } = { ...updateFields };

        let normalizedDate: string | undefined;
        if (updateData.date instanceof Date) {
          normalizedDate = updateData.date.toISOString().split('T')[0];
        } else if (typeof updateData.date === 'string') {
          normalizedDate = updateData.date;
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
            updateData.sourceId = toNullable(updateData.sourceId);
          }
          if ('sourceLineKey' in updateData) {
            updateData.sourceLineKey = toNullable(updateData.sourceLineKey);
          }
          if ('systemGenerated' in updateData) {
            updateData.systemGenerated = Boolean(updateData.systemGenerated);
          }
        }

        if ('paymentMethod' in updateData) {
          updateData.paymentMethod =
            toOptional(updateData.paymentMethod) ?? null;
        }

        if ('paymentCardId' in updateData) {
          updateData.paymentCardId =
            toOptional(updateData.paymentCardId) ?? null;
        }

        const { date: _rawDate, ...updateFieldsRest } = updateData;
        const normalizedUpdate = {
          ...updateFieldsRest,
          ...(normalizedDate ? { date: normalizedDate } : {}),
        };

        return normalizedUpdate;
      },
    });
  }

  async delete(id: number): Promise<GeneralMerchandiseExpenseEntity> {
    try {
      const expense = await this.repository.findById(id);
      if (!expense) {
        throw new Error(`Expense with ID ${id} not found`);
      }

      const deleted = await this.repository.delete(id);

      const { recordChange } = await import('@/core/change-log');
      await recordChange(
        {
          entityType: 'general_merchandise_expense',
          entityId: id,
          action: 'delete',
          oldValue: expense,
          newValue: null,
        },
        { source: 'api' }
      );

      return deleted;
    } catch (error) {
      logger.error('Failed to delete GM expense', { error, id });
      throw error;
    }
  }

  async deleteAll(): Promise<{ count: number }> {
    try {
      return await generalMerchandiseExpenseRepository.deleteMany();
    } catch (error) {
      logger.error('Failed to delete GM expenses', { error });
      throw new Error('Failed to delete GM expenses');
    }
  }
}

export const generalMerchandiseExpenseService =
  new GeneralMerchandiseExpenseService();
