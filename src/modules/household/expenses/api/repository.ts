import type { HouseholdExpense, Prisma } from '@prisma/client';
import { BaseRepository } from '@/core/database/repository';
import type {
  HouseholdExpenseCreateInput,
  HouseholdExpenseUpdateInput,
  HouseholdExpenseQuery,
  HouseholdExpenseCreateDbInput,
} from './schemas';

export class HouseholdExpenseRepository extends BaseRepository<
  HouseholdExpense,
  HouseholdExpenseCreateInput,
  HouseholdExpenseUpdateInput
> {
  protected readonly modelName = 'householdExpense';

  async findWithFilters(
    filters: HouseholdExpenseQuery
  ): Promise<HouseholdExpense[]> {
    const where: Prisma.HouseholdExpenseWhereInput = {};

    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.loggedBy) {
      where.loggedBy = { contains: filters.loggedBy, mode: 'insensitive' };
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
      where,
      orderBy: { date: 'desc' },
    });
  }

  async upsertBySource(
    data: HouseholdExpenseCreateDbInput
  ): Promise<HouseholdExpense> {
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
        loggedBy: data.loggedBy === undefined ? undefined : data.loggedBy,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        sourceLineKey: data.sourceLineKey ?? null,
        systemGenerated: data.systemGenerated ?? false,
      },
    });
  }
}

export const householdExpenseRepository = new HouseholdExpenseRepository();
