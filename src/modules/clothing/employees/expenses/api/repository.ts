/**
 * Expense Repository
 *
 * Data access layer for expenses
 */

import type { Expense, Prisma } from '@prisma/client';
import { BaseRepository } from '@/core/database/repository';
import type {
  ExpenseCreateInput,
  ExpenseUpdateInput,
  ExpenseQuery,
  ExpenseCreateDbInput,
} from './schemas';

export class ExpenseRepository extends BaseRepository<
  Expense,
  ExpenseCreateInput,
  ExpenseUpdateInput
> {
  protected readonly modelName = 'expense';

  /**
   * Find expenses with filters
   */
  async findWithFilters(filters: ExpenseQuery): Promise<Expense[]> {
    const where: Prisma.ExpenseWhereInput = {};

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.employeeName) {
      where.employeeName = {
        contains: filters.employeeName,
        mode: 'insensitive',
      };
    }

    if (filters.sourceType) {
      where.sourceType = filters.sourceType;
    }

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) {
        // Convert Date to string for comparison
        where.date.gte = filters.startDate.toISOString().split('T')[0];
      }
      if (filters.endDate) {
        where.date.lte = filters.endDate.toISOString().split('T')[0];
      }
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.amount = {};
      if (filters.minAmount !== undefined) {
        where.amount.gte = filters.minAmount;
      }
      if (filters.maxAmount !== undefined) {
        where.amount.lte = filters.maxAmount;
      }
    }

    return this.model.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Find expenses by employee name
   */
  async findByEmployeeName(employeeName: string): Promise<Expense[]> {
    const where: Prisma.ExpenseWhereInput = {
      employeeName: {
        contains: employeeName,
        mode: 'insensitive',
      },
    };
    return this.findMany({
      where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Find expenses by status
   */
  async findByStatus(status: string): Promise<Expense[]> {
    const where: Prisma.ExpenseWhereInput = { status };
    return this.findMany({
      where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Find expenses by category
   */
  async findByCategory(category: string): Promise<Expense[]> {
    const where: Prisma.ExpenseWhereInput = { category };
    return this.findMany({
      where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Find expenses in date range
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<Expense[]> {
    const where: Prisma.ExpenseWhereInput = {
      date: {
        gte: startDate.toISOString().split('T')[0],
        lte: endDate.toISOString().split('T')[0],
      },
    };
    return this.findMany({
      where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Get total expenses by category
   */
  async getTotalByCategory(): Promise<Record<string, number>> {
    type GroupByResult = {
      category: string;
      _sum: { amount: number | null };
    };

    const result = (await this.model.groupBy({
      by: ['category'],
      _sum: {
        amount: true,
      },
    })) as GroupByResult[];

    return result.reduce((acc: Record<string, number>, item) => {
      acc[item.category] = item._sum.amount || 0;
      return acc;
    }, {});
  }

  /**
   * Get total expenses by status
   */
  async getTotalByStatus(): Promise<Record<string, number>> {
    type GroupByResult = {
      status: string;
      _sum: { amount: number | null };
    };

    const result = (await this.model.groupBy({
      by: ['status'],
      _sum: {
        amount: true,
      },
    })) as GroupByResult[];

    return result.reduce((acc: Record<string, number>, item) => {
      acc[item.status] = item._sum.amount || 0;
      return acc;
    }, {});
  }

  async upsertBySource(data: ExpenseCreateDbInput): Promise<Expense> {
    if (!data.sourceId) {
      throw new Error('sourceId is required for source-based upsert');
    }

    return this.model.upsert({
      where: {
        sourceType_sourceId_sourceLineKey: {
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          sourceLineKey: data.sourceLineKey ?? null,
        },
      },
      create: data,
      update: {
        date: data.date,
        amount: data.amount,
        description: data.description,
        category: data.category,
        notes: data.notes ?? undefined,
        receipt: data.receipt ?? undefined,
        status: data.status,
        // Allow explicit null to clear Logged By
        employeeName:
          data.employeeName === undefined ? undefined : data.employeeName,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        sourceLineKey: data.sourceLineKey ?? null,
        systemGenerated: data.systemGenerated ?? false,
      },
    });
  }
}

// Export singleton instance
export const expenseRepository = new ExpenseRepository();
