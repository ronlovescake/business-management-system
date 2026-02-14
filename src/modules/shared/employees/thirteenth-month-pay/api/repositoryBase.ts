import type { Prisma } from '@prisma/client';
import { BaseRepository } from '@/core/database/repository/BaseRepository';
import type {
  FindOptions,
  OrderByInput,
  WhereInput,
} from '@/core/database/repository/BaseRepository';
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

  private toWhereInput(value: Record<string, unknown>): WhereInput<TEntity> {
    return value as unknown as WhereInput<TEntity>;
  }

  private toOrderByInput(
    value:
      | Record<string, 'asc' | 'desc'>
      | Array<Record<string, 'asc' | 'desc'>>
  ): OrderByInput<TEntity> | OrderByInput<TEntity>[] {
    return value as unknown as OrderByInput<TEntity> | OrderByInput<TEntity>[];
  }

  private toFindOptions(options: {
    where?: Record<string, unknown>;
    orderBy?:
      | Record<string, 'asc' | 'desc'>
      | Array<Record<string, 'asc' | 'desc'>>;
  }): FindOptions<TEntity> {
    return {
      where: options.where ? this.toWhereInput(options.where) : undefined,
      orderBy: options.orderBy
        ? this.toOrderByInput(options.orderBy)
        : undefined,
    };
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

    return this.findMany(
      this.toFindOptions({
        where: where as unknown as Record<string, unknown>,
        orderBy: [{ employeeName: 'asc' }, { year: 'desc' }],
      })
    );
  }

  async findByEmployeeId(employeeId: string): Promise<TEntity[]> {
    return this.findMany(
      this.toFindOptions({
        where: { employeeId },
        orderBy: { year: 'desc' },
      })
    );
  }

  async findByYear(year: number): Promise<TEntity[]> {
    return this.findMany(
      this.toFindOptions({
        where: { year },
        orderBy: { employeeName: 'asc' },
      })
    );
  }

  async findByStatus(status: string): Promise<TEntity[]> {
    return this.findMany(
      this.toFindOptions({
        where: { status },
        orderBy: [{ year: 'desc' }, { employeeName: 'asc' }],
      })
    );
  }

  async findByRecordId(recordId: string): Promise<TEntity | null> {
    return this.findFirst(
      this.toFindOptions({
        where: { recordId },
      })
    );
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
