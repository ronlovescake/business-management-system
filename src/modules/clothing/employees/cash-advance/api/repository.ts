/**
 * Cash Advance Repository
 *
 * Data access layer for cash advance operations
 */

import type { CashAdvanceRecord, Prisma } from '@prisma/client';
import { BaseRepository } from '@/core/database/repository/BaseRepository';
import type { CashAdvanceQuery } from './schemas';

/**
 * Repository for CashAdvanceRecord entity
 */
export class CashAdvanceRepository extends BaseRepository<
  CashAdvanceRecord,
  Prisma.CashAdvanceRecordCreateInput,
  Prisma.CashAdvanceRecordUpdateInput
> {
  protected readonly modelName = 'cashAdvanceRecord' as const;

  /**
   * Find cash advances with filters
   */
  async findWithFilters(
    filters: CashAdvanceQuery
  ): Promise<CashAdvanceRecord[]> {
    const where: Prisma.CashAdvanceRecordWhereInput = {};

    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters.employeeName) {
      where.employeeName = {
        contains: filters.employeeName,
        mode: 'insensitive',
      };
    }

    if (filters.status) {
      where.status = filters.status;
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

    if (filters.startDate || filters.endDate) {
      where.requestDate = {};
      if (filters.startDate) {
        where.requestDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.requestDate.lte = filters.endDate;
      }
    }

    if (filters.hasBalance) {
      where.remainingBalance = {
        gt: 0,
      };
    }

    return this.findMany({
      where,
      orderBy: { requestDate: 'desc' },
    });
  }

  /**
   * Find cash advances by employee ID
   */
  async findByEmployeeId(employeeId: string): Promise<CashAdvanceRecord[]> {
    return this.findMany({
      where: { employeeId },
      orderBy: { requestDate: 'desc' },
    });
  }

  /**
   * Find cash advances by employee name
   */
  async findByEmployeeName(name: string): Promise<CashAdvanceRecord[]> {
    return this.findMany({
      where: {
        employeeName: {
          contains: name,
          mode: 'insensitive',
        },
      },
      orderBy: { requestDate: 'desc' },
    });
  }

  /**
   * Find cash advances by status
   */
  async findByStatus(status: string): Promise<CashAdvanceRecord[]> {
    return this.findMany({
      where: { status },
      orderBy: { requestDate: 'desc' },
    });
  }

  /**
   * Find cash advances with remaining balance
   */
  async findWithBalance(): Promise<CashAdvanceRecord[]> {
    return this.findMany({
      where: {
        remainingBalance: {
          gt: 0,
        },
      },
      orderBy: { requestDate: 'desc' },
    });
  }

  /**
   * Get total amount by status
   */
  async getTotalByStatus(): Promise<
    Array<{ status: string; total: number; count: number }>
  > {
    interface GroupByResult {
      status: string;
      _sum: {
        amount: Prisma.Decimal | null;
      };
      _count: {
        _all: number;
      };
    }

    const results = (await this.model.groupBy({
      by: ['status'],
      _sum: {
        amount: true,
      },
      _count: {
        _all: true,
      },
    })) as GroupByResult[];

    return results.map((result) => ({
      status: result.status,
      total: result._sum.amount ? Number(result._sum.amount) : 0,
      count: result._count._all,
    }));
  }

  /**
   * Get total outstanding balance
   */
  async getTotalOutstanding(): Promise<number> {
    interface AggregateResult {
      _sum: {
        remainingBalance: Prisma.Decimal | null;
      };
    }

    const result = (await this.model.aggregate({
      _sum: {
        remainingBalance: true,
      },
      where: {
        remainingBalance: {
          gt: 0,
        },
      },
    })) as AggregateResult;

    return result._sum.remainingBalance
      ? Number(result._sum.remainingBalance)
      : 0;
  }
}

// Singleton instance
export const cashAdvanceRepository = new CashAdvanceRepository();
