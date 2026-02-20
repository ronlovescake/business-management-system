import type { Prisma } from '@prisma/client';
import { BaseRepository } from '@/core/database/repository/BaseRepository';
import type {
  OrderByInput,
  WhereInput,
} from '@/core/database/repository/BaseRepository';
import type { PrismaModelName } from '@/types/prisma';

type AmountRange = {
  gte?: number;
  lte?: number;
};

type DateRange = {
  gte?: Date;
  lte?: Date;
};

type EmployeeNameFilter = {
  contains: string;
  mode: 'insensitive';
};

type BalanceFilter = {
  gt: number;
};

export interface CashAdvanceQueryInput {
  employeeId?: string;
  employeeName?: string;
  status?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: Date;
  endDate?: Date;
  hasBalance?: boolean;
}

type CashAdvanceWhereShape = {
  employeeId?: string;
  employeeName?: EmployeeNameFilter;
  status?: string;
  amount?: AmountRange;
  requestDate?: DateRange;
  remainingBalance?: BalanceFilter;
};

export class CashAdvanceRepositoryBase<
  TEntity,
  TCreateInput,
  TUpdateInput,
> extends BaseRepository<TEntity, TCreateInput, TUpdateInput> {
  protected readonly modelName: PrismaModelName;

  constructor(modelName: PrismaModelName) {
    super();
    this.modelName = modelName;
  }

  private buildWhere(input: CashAdvanceWhereShape): WhereInput<TEntity> {
    return input as WhereInput<TEntity>;
  }

  private buildOrderByRequestDateDesc(): OrderByInput<TEntity> {
    return { requestDate: 'desc' } as OrderByInput<TEntity>;
  }

  async findWithFilters(filters: CashAdvanceQueryInput): Promise<TEntity[]> {
    const where: CashAdvanceWhereShape = {};

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
      where: this.buildWhere(where),
      orderBy: this.buildOrderByRequestDateDesc(),
    });
  }

  async findByEmployeeId(employeeId: string): Promise<TEntity[]> {
    return this.findMany({
      where: this.buildWhere({ employeeId }),
      orderBy: this.buildOrderByRequestDateDesc(),
    });
  }

  async findByEmployeeName(name: string): Promise<TEntity[]> {
    return this.findMany({
      where: this.buildWhere({
        employeeName: {
          contains: name,
          mode: 'insensitive',
        },
      }),
      orderBy: this.buildOrderByRequestDateDesc(),
    });
  }

  async findByStatus(status: string): Promise<TEntity[]> {
    return this.findMany({
      where: this.buildWhere({ status }),
      orderBy: this.buildOrderByRequestDateDesc(),
    });
  }

  async findWithBalance(): Promise<TEntity[]> {
    return this.findMany({
      where: this.buildWhere({
        remainingBalance: {
          gt: 0,
        },
      }),
      orderBy: this.buildOrderByRequestDateDesc(),
    });
  }

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
