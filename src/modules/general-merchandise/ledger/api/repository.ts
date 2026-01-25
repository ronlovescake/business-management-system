import { BaseRepository, type WhereInput } from '@/core/database/repository';
import type { PrismaModelName } from '@/types/prisma';
import type {
  GeneralMerchandiseExpenseCreateInput,
  GeneralMerchandiseExpenseUpdateInput,
  GeneralMerchandiseExpenseQuery,
  GeneralMerchandiseExpenseCreateDbInput,
} from './schemas';

export type GeneralMerchandiseExpenseEntity = {
  id: number;
  date: string;
  amount: number;
  description: string;
  category: string;
  notes?: string | null;
  receipt?: string | null;
  status: string;
  employeeName?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  sourceLineKey?: string | null;
  systemGenerated?: boolean | null;
  paymentMethod?: string | null;
  paymentCardId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

type GeneralMerchandiseExpenseWhere = {
  category?: string;
  status?: string;
  sourceType?: string;
  employeeName?: { contains: string; mode: 'insensitive' };
  date?: { gte?: string; lte?: string };
  amount?: { gte?: number; lte?: number };
};

export class GeneralMerchandiseExpenseRepository extends BaseRepository<
  GeneralMerchandiseExpenseEntity,
  GeneralMerchandiseExpenseCreateInput,
  GeneralMerchandiseExpenseUpdateInput
> {
  protected readonly modelName = 'generalMerchandiseExpense' as PrismaModelName;

  async findWithFilters(
    filters: GeneralMerchandiseExpenseQuery
  ): Promise<GeneralMerchandiseExpenseEntity[]> {
    const where: GeneralMerchandiseExpenseWhere = {};

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
      where: where as WhereInput<GeneralMerchandiseExpenseEntity>,
      orderBy: { date: 'desc' },
    });
  }

  async findByEmployeeName(
    employeeName: string
  ): Promise<GeneralMerchandiseExpenseEntity[]> {
    const where: GeneralMerchandiseExpenseWhere = {
      employeeName: {
        contains: employeeName,
        mode: 'insensitive',
      },
    };
    return this.findMany({
      where: where as WhereInput<GeneralMerchandiseExpenseEntity>,
      orderBy: { date: 'desc' },
    });
  }

  async findByStatus(
    status: string
  ): Promise<GeneralMerchandiseExpenseEntity[]> {
    const where: GeneralMerchandiseExpenseWhere = { status };
    return this.findMany({
      where: where as WhereInput<GeneralMerchandiseExpenseEntity>,
      orderBy: { date: 'desc' },
    });
  }

  async findByCategory(
    category: string
  ): Promise<GeneralMerchandiseExpenseEntity[]> {
    const where: GeneralMerchandiseExpenseWhere = { category };
    return this.findMany({
      where: where as WhereInput<GeneralMerchandiseExpenseEntity>,
      orderBy: { date: 'desc' },
    });
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<GeneralMerchandiseExpenseEntity[]> {
    const where: GeneralMerchandiseExpenseWhere = {
      date: {
        gte: startDate.toISOString().split('T')[0],
        lte: endDate.toISOString().split('T')[0],
      },
    };
    return this.findMany({
      where: where as WhereInput<GeneralMerchandiseExpenseEntity>,
      orderBy: { date: 'desc' },
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

  async upsertBySource(
    data: GeneralMerchandiseExpenseCreateDbInput
  ): Promise<GeneralMerchandiseExpenseEntity> {
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

export const generalMerchandiseExpenseRepository =
  new GeneralMerchandiseExpenseRepository();
