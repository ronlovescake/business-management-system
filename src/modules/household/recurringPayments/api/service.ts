import type { HouseholdRecurringPayment, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { HouseholdRecurringPaymentCreateInput } from './schemas';

const toDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const monthKeyFromDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const parseMonthKey = (month: string): Date => {
  const [y, m] = month.split('-').map((p) => Number(p));
  return new Date(y, m - 1, 1);
};

const clampDayInMonth = (year: number, monthIndex: number, day: number) => {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(day, lastDay);
};

const diffMonths = (from: Date, to: Date): number => {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
};

export class HouseholdRecurringPaymentService {
  async findAll(): Promise<HouseholdRecurringPayment[]> {
    return prisma.householdRecurringPayment.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    data: HouseholdRecurringPaymentCreateInput
  ): Promise<HouseholdRecurringPayment> {
    const startDate = toDateString(data.startDate);

    return prisma.householdRecurringPayment.create({
      data: {
        name: data.name,
        amount: data.amount,
        category: data.category,
        notes: data.notes ?? undefined,
        startDate,
        monthsCount: data.monthsCount ?? null,
        isActive: data.isActive ?? true,
        deductOnGenerate: data.deductOnGenerate ?? true,
        accountId: data.accountId ?? null,
      },
    });
  }

  private statusImpactsBalance(status?: string | null): boolean {
    return status === 'approved' || status === 'paid';
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

  async generateForMonth(input?: {
    month?: string;
  }): Promise<{ created: number; skipped: number; month: string }> {
    const monthStart = input?.month
      ? parseMonthKey(input.month)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthKey = input?.month ?? monthKeyFromDate(monthStart);

    const templates = await prisma.householdRecurringPayment.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const results = await prisma.$transaction(async (tx) => {
      let created = 0;
      let skipped = 0;

      for (const tpl of templates) {
        const start = new Date(tpl.startDate);
        const monthIndex = diffMonths(
          new Date(start.getFullYear(), start.getMonth(), 1),
          monthStart
        );

        if (monthIndex < 0) {
          skipped++;
          continue;
        }

        if (tpl.monthsCount !== null && tpl.monthsCount !== undefined) {
          if (monthIndex >= tpl.monthsCount) {
            skipped++;
            continue;
          }
        }

        const existing = await tx.householdExpense.findFirst({
          where: {
            sourceType: 'RECURRING',
            sourceId: tpl.id,
            sourceLineKey: monthKey,
          },
          select: { id: true },
        });

        if (existing) {
          skipped++;
          continue;
        }

        const startDay = new Date(tpl.startDate).getDate();
        const year = monthStart.getFullYear();
        const month = monthStart.getMonth();
        const day = clampDayInMonth(year, month, startDay);
        const expenseDate = toDateString(new Date(year, month, day));

        const status = tpl.deductOnGenerate ? 'paid' : 'pending';
        const accountId = tpl.accountId ?? null;

        if (accountId) {
          await this.ensureAccountExists(tx, accountId);
        }

        const expense = await tx.householdExpense.create({
          data: {
            date: expenseDate,
            amount: tpl.amount,
            description: tpl.name,
            category: tpl.category,
            notes: tpl.notes ?? null,
            receipt: null,
            status,
            loggedBy: 'Recurring',
            paymentMethod: null,
            paymentCardId: null,
            accountId,
            sourceType: 'RECURRING',
            sourceId: tpl.id,
            sourceLineKey: monthKey,
            systemGenerated: true,
          },
          select: { id: true, amount: true, status: true },
        });

        const shouldImpact = this.statusImpactsBalance(expense.status);
        if (shouldImpact && accountId) {
          await tx.householdAccount.update({
            where: { id: accountId },
            data: { balance: { decrement: tpl.amount } },
          });
        }

        created++;
      }

      return { created, skipped };
    });

    logger.info('Generated recurring household expenses', {
      month: monthKey,
      ...results,
      templates: templates.length,
    });

    return { month: monthKey, ...results };
  }
}

export const householdRecurringPaymentService =
  new HouseholdRecurringPaymentService();
