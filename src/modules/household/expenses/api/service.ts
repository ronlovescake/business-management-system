/**
 * Household Expense Service
 *
 * Business logic layer for household/personal expense management
 */

import type { HouseholdExpense } from '@prisma/client';
import { householdExpenseRepository } from './repository';
import type {
  HouseholdExpenseCreateInput,
  HouseholdExpenseUpdateInput,
  HouseholdExpenseQuery,
  HouseholdExpenseCreateDbInput,
} from './schemas';
import { logger } from '@/lib/logger';

export class HouseholdExpenseService {
  private normalizeSourceFields(
    data: Partial<HouseholdExpenseCreateInput>
  ): Pick<
    HouseholdExpenseCreateDbInput,
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
    data: Partial<HouseholdExpenseCreateInput>
  ): Pick<HouseholdExpenseCreateDbInput, 'paymentMethod' | 'paymentCardId'> {
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
    data: HouseholdExpenseCreateInput
  ): HouseholdExpenseCreateDbInput {
    const sourceFields = this.normalizeSourceFields(data);
    const paymentFields = this.normalizePaymentFields(data);

    return {
      ...data,
      ...sourceFields,
      ...paymentFields,
      date: data.date.toISOString().split('T')[0],
      receipt: data.receipt ?? undefined,
      notes: data.notes ?? undefined,
      loggedBy: data.loggedBy === undefined ? undefined : data.loggedBy,
    };
  }

  async findAll(): Promise<HouseholdExpense[]> {
    try {
      return await householdExpenseRepository.findMany({
        orderBy: { date: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to fetch household expenses', { error });
      throw new Error('Failed to fetch household expenses');
    }
  }

  async findWithFilters(
    filters: HouseholdExpenseQuery
  ): Promise<HouseholdExpense[]> {
    try {
      return await householdExpenseRepository.findWithFilters(filters);
    } catch (error) {
      logger.error('Failed to fetch filtered household expenses', {
        error,
        filters,
      });
      throw new Error('Failed to fetch filtered household expenses');
    }
  }

  async findById(id: number): Promise<HouseholdExpense | null> {
    try {
      return await householdExpenseRepository.findById(id);
    } catch (error) {
      logger.error('Failed to fetch household expense', { error, id });
      throw new Error('Failed to fetch household expense');
    }
  }

  async create(data: HouseholdExpenseCreateInput): Promise<HouseholdExpense> {
    try {
      const expenseData = this.normalizeCreateInput(data);

      // Type assertion needed due to BaseRepository generic constraints
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await householdExpenseRepository.create(expenseData as any);
    } catch (error) {
      logger.error('Failed to create household expense', { error, data });
      throw new Error('Failed to create household expense');
    }
  }

  async createMany(
    data: HouseholdExpenseCreateInput[]
  ): Promise<{ count: number }> {
    try {
      const expenses = data.map((expense) =>
        this.normalizeCreateInput(expense)
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await householdExpenseRepository.createMany(expenses as any);
    } catch (error) {
      logger.error('Failed to create household expenses', {
        error,
        count: data.length,
      });
      throw new Error('Failed to create household expenses');
    }
  }

  async update(
    id: number,
    data: Partial<HouseholdExpenseUpdateInput>
  ): Promise<HouseholdExpense> {
    try {
      const existing = await householdExpenseRepository.findById(id);
      if (!existing) {
        throw new Error(`Household expense with ID ${id} not found`);
      }

      const { id: _, ...updateFields } = data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = { ...updateFields };
      if (updateData.date instanceof Date) {
        updateData.date = updateData.date.toISOString().split('T')[0];
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await householdExpenseRepository.update(id, updateData as any);
    } catch (error) {
      logger.error('Failed to update household expense', { error, id, data });
      throw error;
    }
  }

  async updateMany(
    data: HouseholdExpenseUpdateInput[]
  ): Promise<{ count: number }> {
    try {
      let updated = 0;

      for (const expense of data) {
        if (expense.id) {
          await this.update(expense.id, expense);
          updated++;
        }
      }

      return { count: updated };
    } catch (error) {
      logger.error('Failed to update household expenses', {
        error,
        count: data.length,
      });
      throw new Error('Failed to update household expenses');
    }
  }

  async delete(id: number): Promise<void> {
    try {
      await householdExpenseRepository.delete(id);
    } catch (error) {
      logger.error('Failed to delete household expense', { error, id });
      throw new Error('Failed to delete household expense');
    }
  }

  async deleteAll(): Promise<{ count: number }> {
    try {
      return await householdExpenseRepository.deleteMany();
    } catch (error) {
      logger.error('Failed to delete household expenses', { error });
      throw new Error('Failed to delete household expenses');
    }
  }

  async upsertBySource(
    data: HouseholdExpenseCreateDbInput
  ): Promise<HouseholdExpense> {
    try {
      return await householdExpenseRepository.upsertBySource(data);
    } catch (error) {
      logger.error('Failed to upsert household expense by source', {
        error,
        data,
      });
      throw new Error('Failed to upsert household expense by source');
    }
  }
}

export const householdExpenseService = new HouseholdExpenseService();
