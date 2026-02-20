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
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-based month for DTO

    // Month-to-date average: consider from Jan 1 of current year through now.
    const windowStart = new Date(currentYear, 0, 1);

    // HouseholdExpense.date is stored as a string (VarChar), so we cannot
    // reliably use a DB-side date filter. Pull the rows and filter in JS.
    const expenses = await prisma.householdExpense.findMany({
      select: {
        amount: true,
        category: true,
        date: true,
      },
    });

    if (!expenses.length) {
      return [];
    }

    type CatAgg = {
      totalsByMonth: Map<string, number>;
      totalYtd: number;
      currentMonthTotal: number;
    };

    const agg = new Map<string, CatAgg>();

    for (const exp of expenses) {
      const category = exp.category || 'Uncategorized';
      if (typeof exp.date !== 'string' || !exp.date.trim()) {
        continue;
      }
      const expDate = new Date(exp.date);

      if (Number.isNaN(expDate.getTime())) {
        continue; // skip invalid dates
      }

      if (expDate < windowStart || expDate > now) {
        continue; // outside the 12-month window
      }
      const y = expDate.getFullYear();
      const m = expDate.getMonth() + 1; // 1-based
      const ymKey = `${y}-${String(m).padStart(2, '0')}`;

      const entry = agg.get(category) ?? {
        totalsByMonth: new Map<string, number>(),
        totalYtd: 0,
        currentMonthTotal: 0,
      };

      const prev = entry.totalsByMonth.get(ymKey) ?? 0;
      entry.totalsByMonth.set(ymKey, prev + Number(exp.amount ?? 0));
      entry.totalYtd += Number(exp.amount ?? 0);

      if (y === currentYear && m === currentMonth) {
        entry.currentMonthTotal += Number(exp.amount ?? 0);
      }

      agg.set(category, entry);
    }

    const monthsElapsed = currentMonth; // 1-based month already

    const derivedBudgets: HouseholdBudgetDTO[] = Array.from(agg.entries()).map(
      ([category, { totalYtd, currentMonthTotal }]) => {
        const plannedAverage = monthsElapsed > 0 ? totalYtd / monthsElapsed : 0;

        return {
          id: `derived-${category}-${currentYear}-${currentMonth}`,
          category,
          period: 'monthly',
          plannedAmount: Number(plannedAverage.toFixed(2)),
          actualAmount: Number(currentMonthTotal.toFixed(2)),
          month: currentMonth,
          year: currentYear,
          accountId: null,
          accountName: null,
          notes: null,
          createdAt: now,
          updatedAt: now,
        } satisfies HouseholdBudgetDTO;
      }
    );

    // Sort by planned descending to mirror analytics prominence
    return derivedBudgets.sort((a, b) => b.plannedAmount - a.plannedAmount);
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
