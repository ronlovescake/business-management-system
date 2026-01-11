import type { HouseholdBudget, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type {
  HouseholdBudgetCreateInput,
  HouseholdBudgetUpdateInput,
  HouseholdBudgetDeleteInput,
} from './schemas';

export interface HouseholdBudgetDTO {
  id: string;
  category: string;
  period: 'monthly' | 'annual';
  plannedAmount: number;
  actualAmount: number;
  month: number | null;
  year: number | null;
  accountId: string | null;
  accountName: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const mapDTO = (
  record: HouseholdBudget & { accountRef?: { name: string } | null }
): HouseholdBudgetDTO => {
  return {
    id: record.id,
    category: record.category,
    period: record.period as HouseholdBudgetDTO['period'],
    plannedAmount: Number(record.plannedAmount ?? 0),
    actualAmount: Number(record.actualAmount ?? 0),
    month: record.month ?? null,
    year: record.year ?? null,
    accountId: record.accountId ?? null,
    accountName: record.accountRef?.name ?? null,
    notes: record.notes ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

export class HouseholdBudgetService {
  async findAll(): Promise<HouseholdBudgetDTO[]> {
    const items = await prisma.householdBudget.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        accountRef: { select: { name: true } },
      },
    });

    return items.map(mapDTO);
  }

  async create(data: HouseholdBudgetCreateInput): Promise<HouseholdBudgetDTO> {
    const { accountId, ...rest } = data;

    return prisma.$transaction(async (tx) => {
      if (accountId) {
        await this.ensureAccountExists(tx, accountId);
      }

      const created = await tx.householdBudget.create({
        data: {
          ...rest,
          accountId: accountId ?? null,
        },
        include: {
          accountRef: { select: { name: true } },
        },
      });

      logger.info('Household budget created', {
        id: created.id,
        period: created.period,
      });

      return mapDTO(created);
    });
  }

  async update(
    id: string,
    data: HouseholdBudgetUpdateInput
  ): Promise<HouseholdBudgetDTO> {
    const { id: _, accountId, ...rest } = data;

    return prisma.$transaction(async (tx) => {
      if (accountId !== undefined && accountId !== null) {
        await this.ensureAccountExists(tx, accountId);
      }

      const updated = await tx.householdBudget.update({
        where: { id },
        data: {
          ...rest,
          accountId: accountId === undefined ? undefined : accountId,
        },
        include: {
          accountRef: { select: { name: true } },
        },
      });

      logger.info('Household budget updated', { id: updated.id });

      return mapDTO(updated);
    });
  }

  async delete(data: HouseholdBudgetDeleteInput): Promise<HouseholdBudgetDTO> {
    const deleted = await prisma.householdBudget.delete({
      where: { id: data.id },
      include: { accountRef: { select: { name: true } } },
    });

    logger.info('Household budget deleted', { id: deleted.id });

    return mapDTO(deleted);
  }

  private async ensureAccountExists(
    tx: Prisma.TransactionClient,
    accountId: string
  ) {
    const account = await tx.householdAccount.findUnique({
      where: { id: accountId },
      select: { id: true },
    });

    if (!account) {
      throw new Error(`Household account ${accountId} not found`);
    }
  }
}

export const householdBudgetService = new HouseholdBudgetService();
