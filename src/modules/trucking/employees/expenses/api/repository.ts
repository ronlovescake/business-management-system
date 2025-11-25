/**
 * Expense Repository
 *
 * Data access layer for expenses
 */

import type { Prisma, TruckingExpense } from '@prisma/client';
import { BaseRepository } from '@/core/database/repository';
import type {
  ExpenseCreateInput,
  ExpenseUpdateInput,
  ExpenseQuery,
} from './schemas';

export class ExpenseRepository extends BaseRepository<
  TruckingExpense,
  ExpenseCreateInput,
  ExpenseUpdateInput
> {
  protected readonly modelName = 'truckingExpense';

  /**
   * Find expenses with filters
   */
  async findWithFilters(filters: ExpenseQuery): Promise<TruckingExpense[]> {
    const where: Prisma.TruckingExpenseWhereInput = {};

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
  async findByEmployeeName(employeeName: string): Promise<TruckingExpense[]> {
    const where: Prisma.TruckingExpenseWhereInput = {
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
  async findByStatus(status: string): Promise<TruckingExpense[]> {
    const where: Prisma.TruckingExpenseWhereInput = { status };
    return this.findMany({
      where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Find expenses by category
   */
  async findByCategory(category: string): Promise<TruckingExpense[]> {
    const where: Prisma.TruckingExpenseWhereInput = { category };
    return this.findMany({
      where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Find expenses in date range
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<TruckingExpense[]> {
    const where: Prisma.TruckingExpenseWhereInput = {
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
}

// Export singleton instance
export const expenseRepository = new ExpenseRepository();
