import { BaseRepository } from '@/core/database/repository';
import type { OrderByInput, WhereInput } from '@/core/database/repository';
import type { PrismaModelName } from '@/types/prisma';

type ExpenseQueryLike = {
  category?: string;
  status?: string;
  employeeName?: string;
  sourceType?: string;
  vehicleId?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
};

type DateRangeFilter = {
  gte?: string;
  lte?: string;
};

type AmountRangeFilter = {
  gte?: number;
  lte?: number;
};

type ExpenseCreateLike = {
  sourceType?: string | null;
  sourceId?: string | null;
  sourceLineKey?: string | null;
  date: string;
  amount: number;
  description: string;
  category: string;
  notes?: string | null;
  receipt?: string | null;
  status: string;
  paymentMethod?: string | null;
  paymentCardId?: string | null;
  employeeName?: string | null;
  systemGenerated?: boolean;
};

export class ExpenseRepositoryBase<
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
    return value as WhereInput<TEntity>;
  }

  private toOrderByInput(
    value: Record<string, 'asc' | 'desc'>
  ): OrderByInput<TEntity> {
    return value as OrderByInput<TEntity>;
  }

  async findWithFilters(filters: ExpenseQueryLike): Promise<TEntity[]> {
    const where: Record<string, unknown> = {};

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

    if (filters.vehicleId) {
      where.vehicleId = filters.vehicleId;
    }

    if (filters.startDate || filters.endDate) {
      const dateFilter: DateRangeFilter = {};
      if (filters.startDate) {
        dateFilter.gte = filters.startDate.toISOString().split('T')[0];
      }
      if (filters.endDate) {
        dateFilter.lte = filters.endDate.toISOString().split('T')[0];
      }
      where.date = dateFilter;
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      const amountFilter: AmountRangeFilter = {};
      if (filters.minAmount !== undefined) {
        amountFilter.gte = filters.minAmount;
      }
      if (filters.maxAmount !== undefined) {
        amountFilter.lte = filters.maxAmount;
      }
      where.amount = amountFilter;
    }

    return this.model.findMany({
      where: this.toWhereInput(where),
      orderBy: this.toOrderByInput({ date: 'desc' }),
    });
  }

  async findByEmployeeName(employeeName: string): Promise<TEntity[]> {
    return this.findMany({
      where: this.toWhereInput({
        employeeName: {
          contains: employeeName,
          mode: 'insensitive',
        },
      }),
      orderBy: this.toOrderByInput({ date: 'desc' }),
    });
  }

  async findByStatus(status: string): Promise<TEntity[]> {
    return this.findMany({
      where: this.toWhereInput({ status }),
      orderBy: this.toOrderByInput({ date: 'desc' }),
    });
  }

  async findByCategory(category: string): Promise<TEntity[]> {
    return this.findMany({
      where: this.toWhereInput({ category }),
      orderBy: this.toOrderByInput({ date: 'desc' }),
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<TEntity[]> {
    return this.findMany({
      where: this.toWhereInput({
        date: {
          gte: startDate.toISOString().split('T')[0],
          lte: endDate.toISOString().split('T')[0],
        },
      }),
      orderBy: this.toOrderByInput({ date: 'desc' }),
    });
  }

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

  async upsertBySource(data: ExpenseCreateLike): Promise<TEntity> {
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
        paymentMethod: data.paymentMethod ?? null,
        paymentCardId: data.paymentCardId ?? null,
        employeeName:
          data.employeeName === undefined ? undefined : data.employeeName,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        sourceLineKey: data.sourceLineKey ?? null,
        systemGenerated: data.systemGenerated ?? false,
      },
    });
  }

  async softDelete(id: number): Promise<TEntity> {
    const existing = await this.findFirst({
      where: this.toWhereInput({ id, deletedAt: null }),
    });

    if (!existing) {
      throw new Error(`Expense with ID ${id} not found`);
    }

    return this.model.update({
      where: { id },
      data: { deletedAt: new Date() } as TUpdateInput,
    });
  }

  async softDeleteMany(
    where?: WhereInput<TEntity>
  ): Promise<{ count: number }> {
    return this.model.updateMany({
      where: this.toWhereInput({
        ...(where as Record<string, unknown> | undefined),
        deletedAt: null,
      }),
      data: { deletedAt: new Date() } as TUpdateInput,
    });
  }
}
