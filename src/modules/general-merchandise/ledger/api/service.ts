import { logger } from '@/lib/logger';
import {
  generalMerchandiseExpenseRepository,
  type GeneralMerchandiseExpenseEntity,
} from './repository';
import type {
  GeneralMerchandiseExpenseCreateInput,
  GeneralMerchandiseExpenseUpdateInput,
  GeneralMerchandiseExpenseQuery,
  GeneralMerchandiseExpenseCreateDbInput,
  GeneralMerchandiseExpenseUpdateDbInput,
} from './schemas';

export class GeneralMerchandiseExpenseService {
  private normalizeSourceFields(
    data: Partial<{
      sourceType?: string | null;
      sourceId?: string | null;
      sourceLineKey?: string | null;
      systemGenerated?: boolean;
    }>
  ): Pick<
    GeneralMerchandiseExpenseCreateDbInput,
    'sourceType' | 'sourceId' | 'sourceLineKey' | 'systemGenerated'
  > {
    const sourceType = (data.sourceType ?? 'MANUAL').toUpperCase();

    const toNullable = (value?: string | null) => {
      if (value === undefined || value === null) {
        return null;
      }
      const trimmed = String(value).trim();
      return trimmed.length === 0 ? null : trimmed;
    };

    return {
      sourceType,
      sourceId: toNullable(data.sourceId),
      sourceLineKey: toNullable(data.sourceLineKey),
      systemGenerated: data.systemGenerated ?? false,
    };
  }

  private normalizePaymentFields(
    data: Partial<{
      paymentMethod?: string | null;
      paymentCardId?: string | null;
    }>
  ): Pick<
    GeneralMerchandiseExpenseCreateDbInput,
    'paymentMethod' | 'paymentCardId'
  > {
    const toOptional = (value?: string | null) => {
      if (value === undefined || value === null) {
        return undefined;
      }
      const trimmed = String(value).trim();
      return trimmed.length === 0 ? undefined : trimmed;
    };

    return {
      paymentMethod: toOptional(data.paymentMethod),
      paymentCardId: toOptional(data.paymentCardId),
    };
  }

  private normalizeCreateInput(
    data: GeneralMerchandiseExpenseCreateInput
  ): GeneralMerchandiseExpenseCreateDbInput {
    const sourceFields = this.normalizeSourceFields(data);
    const paymentFields = this.normalizePaymentFields(data);

    return {
      ...data,
      ...sourceFields,
      ...paymentFields,
      date: data.date.toISOString().split('T')[0],
      receipt: data.receipt ?? undefined,
      notes: data.notes ?? undefined,
      employeeName:
        data.employeeName === undefined ? undefined : data.employeeName,
    };
  }

  async findAll(): Promise<GeneralMerchandiseExpenseEntity[]> {
    try {
      return await generalMerchandiseExpenseRepository.findMany({
        orderBy: { date: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to fetch GM expenses', { error });
      throw new Error('Failed to fetch GM expenses');
    }
  }

  async findWithFilters(
    filters: GeneralMerchandiseExpenseQuery
  ): Promise<GeneralMerchandiseExpenseEntity[]> {
    try {
      return await generalMerchandiseExpenseRepository.findWithFilters(filters);
    } catch (error) {
      logger.error('Failed to fetch filtered GM expenses', { error, filters });
      throw new Error('Failed to fetch GM expenses');
    }
  }

  async findById(id: number): Promise<GeneralMerchandiseExpenseEntity | null> {
    try {
      return await generalMerchandiseExpenseRepository.findById(id);
    } catch (error) {
      logger.error('Failed to fetch GM expense', { error, id });
      throw new Error('Failed to fetch GM expense');
    }
  }

  async create(
    data: GeneralMerchandiseExpenseCreateInput
  ): Promise<GeneralMerchandiseExpenseEntity> {
    try {
      const expenseData = this.normalizeCreateInput(data);
      return await generalMerchandiseExpenseRepository.create(expenseData);
    } catch (error) {
      logger.error('Failed to create GM expense', { error, data });
      throw new Error('Failed to create GM expense');
    }
  }

  async createMany(
    data: GeneralMerchandiseExpenseCreateInput[]
  ): Promise<{ count: number }> {
    try {
      const expenses = data.map((expense) =>
        this.normalizeCreateInput(expense)
      );
      return await generalMerchandiseExpenseRepository.createMany(expenses);
    } catch (error) {
      logger.error('Failed to create GM expenses', {
        error,
        count: data.length,
      });
      throw new Error('Failed to create GM expenses');
    }
  }

  async update(
    id: number,
    data: Partial<GeneralMerchandiseExpenseUpdateInput>
  ): Promise<GeneralMerchandiseExpenseEntity> {
    try {
      const existing = await generalMerchandiseExpenseRepository.findById(id);
      if (!existing) {
        throw new Error(`Expense with ID ${id} not found`);
      }

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

      const shouldNormalizeSource =
        'sourceType' in updateData ||
        'sourceId' in updateData ||
        'sourceLineKey' in updateData ||
        'systemGenerated' in updateData;

      if (shouldNormalizeSource) {
        const normalized = this.normalizeSourceFields(updateData);
        if ('sourceType' in updateData) {
          updateData.sourceType = normalized.sourceType;
        }
        if ('sourceId' in updateData) {
          updateData.sourceId = normalized.sourceId;
        }
        if ('sourceLineKey' in updateData) {
          updateData.sourceLineKey = normalized.sourceLineKey;
        }
        if ('systemGenerated' in updateData) {
          updateData.systemGenerated = normalized.systemGenerated;
        }
      }

      const shouldNormalizePayment =
        'paymentMethod' in updateData || 'paymentCardId' in updateData;

      if (shouldNormalizePayment) {
        const normalizedPayment = this.normalizePaymentFields(updateData);
        if ('paymentMethod' in updateData) {
          updateData.paymentMethod = normalizedPayment.paymentMethod ?? null;
        }
        if ('paymentCardId' in updateData) {
          updateData.paymentCardId = normalizedPayment.paymentCardId ?? null;
        }
      }

      const { date: _rawDate, ...updateFieldsRest } = updateData;
      const normalizedUpdate: GeneralMerchandiseExpenseUpdateDbInput = {
        ...updateFieldsRest,
        ...(normalizedDate ? { date: normalizedDate } : {}),
      };

      const updated = await generalMerchandiseExpenseRepository.update(
        id,
        normalizedUpdate
      );

      const { recordChange } = await import('@/core/change-log');
      await recordChange(
        {
          entityType: 'general_merchandise_expense',
          entityId: id,
          action: 'update',
          oldValue: existing,
          newValue: updated,
        },
        {
          source: 'api',
        }
      );

      return updated;
    } catch (error) {
      logger.error('Failed to update GM expense', { error, id, data });
      throw error;
    }
  }

  async updateMany(
    data: GeneralMerchandiseExpenseUpdateInput[]
  ): Promise<{ count: number }> {
    try {
      let updated = 0;
      for (const item of data) {
        await this.update(item.id, item);
        updated += 1;
      }
      return { count: updated };
    } catch (error) {
      logger.error('Failed to update GM expenses', {
        error,
        count: data.length,
      });
      throw new Error('Failed to update GM expenses');
    }
  }

  async delete(id: number): Promise<GeneralMerchandiseExpenseEntity> {
    try {
      const expense = await generalMerchandiseExpenseRepository.findById(id);
      if (!expense) {
        throw new Error(`Expense with ID ${id} not found`);
      }

      const deleted = await generalMerchandiseExpenseRepository.delete(id);

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
      return await generalMerchandiseExpenseRepository.deleteMany({});
    } catch (error) {
      logger.error('Failed to delete GM expenses', { error });
      throw new Error('Failed to delete GM expenses');
    }
  }
}

export const generalMerchandiseExpenseService =
  new GeneralMerchandiseExpenseService();
