/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Prisma } from '@prisma/client';
import { BaseRepository } from '@/core/database/repository/BaseRepository';
import type { PrismaModelName } from '@/types/prisma';

export interface ThirteenthMonthPayQueryInput {
  employeeId?: string;
  employeeName?: string;
  year?: number;
  status?: string;
  minAmount?: number;
  maxAmount?: number;
}

type PayAmountRange = {
  gte?: number;
  lte?: number;
};

type NameFilter = {
  contains: string;
  mode: 'insensitive';
};

type ThirteenthMonthPayWhere = {
  employeeId?: string;
  employeeName?: NameFilter;
  year?: number;
  status?: string;
  thirteenthMonthPay?: PayAmountRange;
  recordId?: string;
};

export class ThirteenthMonthPayRepositoryBase<
  TEntity,
  TCreateInput,
  TUpdateInput,
> extends BaseRepository<TEntity, TCreateInput, TUpdateInput> {
  protected readonly modelName: PrismaModelName;

  constructor(modelName: PrismaModelName) {
    super();
    this.modelName = modelName;
  }

  async findWithFilters(
    filters: ThirteenthMonthPayQueryInput
  ): Promise<TEntity[]> {
    const where: ThirteenthMonthPayWhere = {};

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

    return this.findMany({
      where: where as any,
      orderBy: [{ employeeName: 'asc' }, { year: 'desc' }] as any,
    });
  }

  async findByEmployeeId(employeeId: string): Promise<TEntity[]> {
    return this.findMany({
      where: { employeeId } as any,
      orderBy: { year: 'desc' } as any,
    });
  }

  async findByYear(year: number): Promise<TEntity[]> {
    return this.findMany({
      where: { year } as any,
      orderBy: { employeeName: 'asc' } as any,
    });
  }

  async findByStatus(status: string): Promise<TEntity[]> {
    return this.findMany({
      where: { status } as any,
      orderBy: [{ year: 'desc' }, { employeeName: 'asc' }] as any,
    });
  }

  async findByRecordId(recordId: string): Promise<TEntity | null> {
    return this.findFirst({
      where: { recordId } as any,
    });
  }

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
