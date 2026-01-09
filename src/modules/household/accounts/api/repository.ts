import type { HouseholdAccount, Prisma } from '@prisma/client';
import { BaseRepository } from '@/core/database/repository';
import type {
  HouseholdAccountCreateDbInput,
  HouseholdAccountUpdateInput,
  HouseholdAccountQuery,
} from './schemas';

export class HouseholdAccountRepository extends BaseRepository<
  HouseholdAccount,
  HouseholdAccountCreateDbInput,
  HouseholdAccountUpdateInput
> {
  protected readonly modelName = 'householdAccount';

  async findWithFilters(
    filters: HouseholdAccountQuery
  ): Promise<HouseholdAccount[]> {
    const where: Prisma.HouseholdAccountWhereInput = {};

    if (filters.type) {
      where.type = filters.type;
    }

    if (typeof filters.isActive === 'boolean') {
      where.isActive = filters.isActive;
    }

    if (filters.institution) {
      where.institution = {
        contains: filters.institution,
        mode: 'insensitive',
      };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { institution: { contains: filters.search, mode: 'insensitive' } },
        {
          accountNumberLast4: { contains: filters.search, mode: 'insensitive' },
        },
      ];
    }

    return this.model.findMany({ where, orderBy: { createdAt: 'desc' } });
  }
}

export const householdAccountRepository = new HouseholdAccountRepository();
