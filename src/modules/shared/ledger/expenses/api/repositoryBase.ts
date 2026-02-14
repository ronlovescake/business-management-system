/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseRepository } from '@/core/database/repository';
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

  async findWithFilters(filters: ExpenseQueryLike): Promise<TEntity[]> {
    const where: Record<string, any> = {};

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
      where.date = {};
      if (filters.startDate) {
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

  async findByEmployeeName(employeeName: string): Promise<TEntity[]> {
    return this.findMany({
      where: {
        employeeName: {
          contains: employeeName,
          mode: 'insensitive',
        },
      } as any,
      orderBy: { date: 'desc' } as any,
    });
  }

  async findByStatus(status: string): Promise<TEntity[]> {
    return this.findMany({
      where: { status } as any,
      orderBy: { date: 'desc' } as any,
    });
  }

  async findByCategory(category: string): Promise<TEntity[]> {
    return this.findMany({
      where: { category } as any,
      orderBy: { date: 'desc' } as any,
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<TEntity[]> {
    return this.findMany({
      where: {
        date: {
          gte: startDate.toISOString().split('T')[0],
          lte: endDate.toISOString().split('T')[0],
        },
      } as any,
      orderBy: { date: 'desc' } as any,
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
}
