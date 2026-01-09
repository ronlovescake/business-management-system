import type { HouseholdIncome, Prisma } from '@prisma/client';
import { BaseRepository } from '@/core/database/repository';
import type {
  HouseholdIncomeCreateDbInput,
  HouseholdIncomeUpdateInput,
  HouseholdIncomeQuery,
} from './schemas';

export class HouseholdIncomeRepository extends BaseRepository<
  HouseholdIncome,
  HouseholdIncomeCreateDbInput,
  HouseholdIncomeUpdateInput
> {
  protected readonly modelName = 'householdIncome';

  async findWithFilters(
    filters: HouseholdIncomeQuery
  ): Promise<HouseholdIncome[]> {
    const where: Prisma.HouseholdIncomeWhereInput = {};

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.account) {
      where.account = {
        contains: filters.account,
        mode: 'insensitive',
      };
    }

    if (filters.search) {
      where.OR = [
        { account: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
        { type: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.startDate || filters.endDate) {
      const start = filters.startDate
        ? filters.startDate.toISOString().split('T')[0]
        : undefined;
      const end = filters.endDate
        ? filters.endDate.toISOString().split('T')[0]
        : undefined;

      where.AND = [
        start ? { date: { gte: start } } : undefined,
        end ? { date: { lte: end } } : undefined,
      ].filter(Boolean) as Prisma.HouseholdIncomeWhereInput[];
    }

    return this.model.findMany({ where, orderBy: { date: 'desc' } });
  }
}

export const householdIncomeRepository = new HouseholdIncomeRepository();
