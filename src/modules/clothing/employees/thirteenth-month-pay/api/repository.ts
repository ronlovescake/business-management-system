/**
 * Thirteenth Month Pay Repository
 *
 * Data access layer for 13th month pay operations
 *
 * Note: This file contains 'as any' type assertions due to incompatibility between
 * BaseRepository's generic types and Prisma's strict where clause types. This is an
 * architectural limitation that would require refactoring BaseRepository to resolve.
 * The eslint warnings are accepted as unavoidable in this context.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ThirteenthMonthPayRecord, Prisma } from '@prisma/client';
import { BaseRepository } from '@/core/database/repository/BaseRepository';
import type { ThirteenthMonthPayQuery } from './schemas';

/**
 * Repository for ThirteenthMonthPayRecord entity
 */
export class ThirteenthMonthPayRepository extends BaseRepository<
  ThirteenthMonthPayRecord,
  Prisma.ThirteenthMonthPayRecordCreateInput,
  Prisma.ThirteenthMonthPayRecordUpdateInput
> {
  protected readonly modelName = 'thirteenthMonthPayRecord' as const;

  /**
   * Find records with filters
   */
  async findWithFilters(
    filters: ThirteenthMonthPayQuery
  ): Promise<ThirteenthMonthPayRecord[]> {
    const where: Prisma.ThirteenthMonthPayRecordWhereInput = {};

    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters.employeeName) {
      where.employeeName = {
        contains: filters.employeeName,
        mode: 'insensitive',
      };
    }

    if (filters.year) {
      where.year = filters.year;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.thirteenthMonthPay = {};
      if (filters.minAmount !== undefined) {
        where.thirteenthMonthPay.gte = filters.minAmount;
      }
      if (filters.maxAmount !== undefined) {
        where.thirteenthMonthPay.lte = filters.maxAmount;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.findMany({
      where,
      orderBy: [{ employeeName: 'asc' }, { year: 'desc' }],
    } as any);
  }

  /**
   * Find by employee ID
   */
  async findByEmployeeId(
    employeeId: string
  ): Promise<ThirteenthMonthPayRecord[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.findMany({
      where: { employeeId },
      orderBy: { year: 'desc' },
    } as any);
  }

  /**
   * Find by year
   */
  async findByYear(year: number): Promise<ThirteenthMonthPayRecord[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.findMany({
      where: { year },
      orderBy: { employeeName: 'asc' },
    } as any);
  }

  /**
   * Find by status
   */
  async findByStatus(status: string): Promise<ThirteenthMonthPayRecord[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.findMany({
      where: { status },
      orderBy: [{ year: 'desc' }, { employeeName: 'asc' }],
    } as any);
  }

  /**
   * Find by record ID
   */
  async findByRecordId(
    recordId: string
  ): Promise<ThirteenthMonthPayRecord | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.findFirst({
      where: {
        recordId,
      },
    } as any);
  }

  /**
   * Get total by status
   */
  async getTotalByStatus(): Promise<
    Array<{ status: string; total: number; count: number }>
  > {
    interface GroupByResult {
      status: string;
      _sum: {
        thirteenthMonthPay: Prisma.Decimal | null;
      };
      _count: {
        _all: number;
      };
    }

    const results = (await this.model.groupBy({
      by: ['status'],
      _sum: {
        thirteenthMonthPay: true,
      },
      _count: {
        _all: true,
      },
    })) as GroupByResult[];

    return results.map((result) => ({
      status: result.status,
      total: result._sum.thirteenthMonthPay
        ? Number(result._sum.thirteenthMonthPay)
        : 0,
      count: result._count._all,
    }));
  }

  /**
   * Get total by year
   */
  async getTotalByYear(): Promise<
    Array<{ year: number; total: number; count: number }>
  > {
    interface GroupByResult {
      year: number;
      _sum: {
        thirteenthMonthPay: Prisma.Decimal | null;
      };
      _count: {
        _all: number;
      };
    }

    const results = (await this.model.groupBy({
      by: ['year'],
      _sum: {
        thirteenthMonthPay: true,
      },
      _count: {
        _all: true,
      },
      orderBy: {
        year: 'desc',
      },
    })) as GroupByResult[];

    return results.map((result) => ({
      year: result.year,
      total: result._sum.thirteenthMonthPay
        ? Number(result._sum.thirteenthMonthPay)
        : 0,
      count: result._count._all,
    }));
  }
}

// Singleton instance
export const thirteenthMonthPayRepository = new ThirteenthMonthPayRepository();
