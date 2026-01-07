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
import type { ExpenseCreateDbInput } from './schemas';
import { logger } from '@/lib/logger';

export class ExpenseService {
  private normalizeSourceFields(
    data: Partial<ExpenseCreateInput>
  ): Pick<
    ExpenseCreateDbInput,
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
    data: Partial<ExpenseCreateInput>
  ): Pick<ExpenseCreateDbInput, 'paymentMethod' | 'paymentCardId'> {
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

  private normalizeCreateInput(data: ExpenseCreateInput): ExpenseCreateDbInput {
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

  /**
   * Get all expenses
   */
  async findAll(): Promise<Expense[]> {
    try {
      return await expenseRepository.findMany({
        orderBy: { date: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to fetch expenses', { error });
      throw new Error('Failed to fetch expenses');
    }
  }

  /**
   * Get expenses with filters
   */
  async findWithFilters(filters: ExpenseQuery): Promise<Expense[]> {
    try {
      return await expenseRepository.findWithFilters(filters);
    } catch (error) {
      logger.error('Failed to fetch filtered expenses', { error, filters });
      throw new Error('Failed to fetch filtered expenses');
    }
  }

  /**
   * Get expense by ID
   */
  async findById(id: number): Promise<Expense | null> {
    try {
      return await expenseRepository.findById(id);
    } catch (error) {
      logger.error('Failed to fetch expense', { error, id });
      throw new Error('Failed to fetch expense');
    }
  }

  /**
   * Create a new expense
   */
  async create(data: ExpenseCreateInput): Promise<Expense> {
    try {
      const expenseData = this.normalizeCreateInput(data);

      // Type assertion needed: ExpenseCreateDbInput structure matches database schema
      // but type system cannot verify due to BaseRepository's generic constraints
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await expenseRepository.create(expenseData as any);
    } catch (error) {
      logger.error('Failed to create expense', { error, data });
      throw new Error('Failed to create expense');
    }
  }

  /**
   * Create multiple expenses (batch)
   */
  async createMany(data: ExpenseCreateInput[]): Promise<{ count: number }> {
    try {
      const expenses = data.map((expense) =>
        this.normalizeCreateInput(expense)
      );

      // Type assertion needed: Converted data matches database schema
      // but type system cannot verify due to BaseRepository's generic constraints
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await expenseRepository.createMany(expenses as any);
    } catch (error) {
      logger.error('Failed to create expenses', { error, count: data.length });
      throw new Error('Failed to create expenses');
    }
  }

  /**
   * Update an expense
   */
  async update(
    id: number,
    data: Partial<ExpenseUpdateInput>
  ): Promise<Expense> {
    try {
      // Check if expense exists
      const existing = await expenseRepository.findById(id);
      if (!existing) {
        throw new Error(`Expense with ID ${id} not found`);
      }

      // Convert Date to string if present and remove id from update
      const { id: _, ...updateFields } = data;
      // Type assertion needed: Dynamic update data structure matches database schema
      // but type system cannot verify due to BaseRepository's generic constraints
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

      // Type assertion needed: Converted data matches database schema
      // but type system cannot verify due to BaseRepository's generic constraints
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = await expenseRepository.update(id, updateData as any);

      // Record the change in audit log - Log full record with old and new values
      const { recordChange } = await import('@/core/change-log');
      await recordChange(
        {
          entityType: 'expense',
          entityId: id,
          action: 'update',
          oldValue: existing, // Full record BEFORE update
          newValue: updated, // Full record AFTER update
        },
        {
          source: 'api',
        }
      );

      return updated;
    } catch (error) {
      logger.error('Failed to update expense', { error, id, data });
      throw error;
    }
  }

  /**
   * Update multiple expenses (batch)
   */
  async updateMany(data: ExpenseUpdateInput[]): Promise<{ count: number }> {
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
      logger.error('Failed to update expenses', { error, count: data.length });
      throw new Error('Failed to update expenses');
    }
  }

  /**
   * Delete an expense (soft delete if supported, hard delete otherwise)
   */
  async delete(id: number): Promise<void> {
    try {
      // Check if expense exists
      const existing = await expenseRepository.findById(id);
      if (!existing) {
        throw new Error(`Expense with ID ${id} not found`);
      }

      await expenseRepository.delete(id);
      logger.info('Expense deleted', { id });
    } catch (error) {
      logger.error('Failed to delete expense', { error, id });
      throw error;
    }
  }

  /**
   * Delete all expenses
   */
  async deleteAll(): Promise<{ count: number }> {
    try {
      const expenses = await expenseRepository.findMany({});
      let count = 0;

      for (const expense of expenses) {
        await expenseRepository.delete(expense.id);
        count++;
      }

      logger.warn('All expenses deleted', { count });
      return { count };
    } catch (error) {
      logger.error('Failed to delete all expenses', { error });
      throw new Error('Failed to delete all expenses');
    }
  }

  /**
   * Get expenses by employee name
   */
  async findByEmployeeName(employeeName: string): Promise<Expense[]> {
    try {
      return await expenseRepository.findByEmployeeName(employeeName);
    } catch (error) {
      logger.error('Failed to fetch expenses by employee', {
        error,
        employeeName,
      });
      throw new Error('Failed to fetch expenses by employee');
    }
  }

  /**
   * Get expenses by status
   */
  async findByStatus(status: string): Promise<Expense[]> {
    try {
      return await expenseRepository.findByStatus(status);
    } catch (error) {
      logger.error('Failed to fetch expenses by status', { error, status });
      throw new Error('Failed to fetch expenses by status');
    }
  }

  /**
   * Get expenses by category
   */
  async findByCategory(category: string): Promise<Expense[]> {
    try {
      return await expenseRepository.findByCategory(category);
    } catch (error) {
      logger.error('Failed to fetch expenses by category', { error, category });
      throw new Error('Failed to fetch expenses by category');
    }
  }

  /**
   * Get expenses in date range
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<Expense[]> {
    try {
      return await expenseRepository.findByDateRange(startDate, endDate);
    } catch (error) {
      logger.error('Failed to fetch expenses by date range', {
        error,
        startDate,
        endDate,
      });
      throw new Error('Failed to fetch expenses by date range');
    }
  }

  /**
   * Get expense statistics by category
   */
  async getStatsByCategory(): Promise<Record<string, number>> {
    try {
      return await expenseRepository.getTotalByCategory();
    } catch (error) {
      logger.error('Failed to fetch expense stats by category', { error });
      throw new Error('Failed to fetch expense stats by category');
    }
  }

  /**
   * Get expense statistics by status
   */
  async getStatsByStatus(): Promise<Record<string, number>> {
    try {
      return await expenseRepository.getTotalByStatus();
    } catch (error) {
      logger.error('Failed to fetch expense stats by status', { error });
      throw new Error('Failed to fetch expense stats by status');
    }
  }

  async upsertBySource(
    payload: ExpenseCreateInput & { sourceId: string }
  ): Promise<Expense> {
    if (!payload.sourceId) {
      throw new Error('sourceId is required for source-based upsert');
    }

    const expenseData = this.normalizeCreateInput(payload);
    return expenseRepository.upsertBySource(expenseData);
  }
}

// Export singleton instance
export const expenseService = new ExpenseService();
