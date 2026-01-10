/**
 * Household Income Service
 *
 * Business logic layer for household/personal income records.
 */

import type { HouseholdIncome, Prisma } from '@prisma/client';
import { householdIncomeRepository } from './repository';
import type {
  HouseholdIncomeCreateDbInput,
  HouseholdIncomeCreateInput,
  HouseholdIncomeUpdateInput,
  HouseholdIncomeQuery,
} from './schemas';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';

export class HouseholdIncomeService {
  private normalizeCreateInput(
    data: HouseholdIncomeCreateInput
  ): HouseholdIncomeCreateDbInput {
    return {
      date: data.date.toISOString().split('T')[0],
      type: data.type,
      amount: data.amount,
      account: data.account ?? undefined,
      accountId: data.accountId ?? undefined,
      notes: data.notes ?? undefined,
    };
  }

  private async resolveAccountName(
    tx: Prisma.TransactionClient,
    accountId: string
  ): Promise<string> {
    const account = await tx.householdAccount.findUnique({
      where: { id: accountId },
      select: { id: true, name: true },
    });
    if (!account) {
      throw new Error(`Household account ${accountId} not found`);
    }
    return account.name;
  }

  async findAll(): Promise<HouseholdIncome[]> {
    try {
      return await householdIncomeRepository.findMany({
        orderBy: { date: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to fetch household income', { error });
      throw new Error('Failed to fetch household income');
    }
  }

  async findWithFilters(
    filters: HouseholdIncomeQuery
  ): Promise<HouseholdIncome[]> {
    try {
      return await householdIncomeRepository.findWithFilters(filters);
    } catch (error) {
      logger.error('Failed to fetch household income with filters', {
        error,
        filters,
      });
      throw new Error('Failed to fetch household income');
    }
  }

  async create(data: HouseholdIncomeCreateInput): Promise<HouseholdIncome> {
    try {
      const incomeData = this.normalizeCreateInput(data);

      return await prisma.$transaction(async (tx) => {
        const accountId = incomeData.accountId ?? null;
        const accountName = accountId
          ? await this.resolveAccountName(tx, accountId)
          : null;

        const created = await tx.householdIncome.create({
          data: {
            ...incomeData,
            accountId,
            account: accountName ?? incomeData.account ?? null,
          },
        });

        if (accountId) {
          await tx.householdAccount.update({
            where: { id: accountId },
            data: { balance: { increment: created.amount } },
          });
        }

        return created;
      });
    } catch (error) {
      logger.error('Failed to create household income', { error, data });
      throw new Error('Failed to create household income');
    }
  }

  async createMany(
    data: HouseholdIncomeCreateInput[]
  ): Promise<{ count: number }> {
    try {
      const rows = data.map((row) => this.normalizeCreateInput(row));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await householdIncomeRepository.createMany(rows as any);
    } catch (error) {
      logger.error('Failed to create household income records', {
        error,
        count: data.length,
      });
      throw new Error('Failed to create household income records');
    }
  }

  async update(
    id: string,
    data: Partial<HouseholdIncomeUpdateInput>
  ): Promise<HouseholdIncome> {
    try {
      const { id: _, date, ...rest } = data;

      return await prisma.$transaction(async (tx) => {
        const existing = await tx.householdIncome.findUnique({
          where: { id },
          select: { id: true, amount: true, accountId: true },
        });
        if (!existing) {
          throw new Error(`Household income with ID ${id} not found`);
        }

        const hasAccountId = Object.prototype.hasOwnProperty.call(
          rest,
          'accountId'
        );
        const hasAmount = Object.prototype.hasOwnProperty.call(rest, 'amount');
        const hasAccountText = Object.prototype.hasOwnProperty.call(
          rest,
          'account'
        );

        const nextAccountId = hasAccountId
          ? ((rest as { accountId?: string | null }).accountId ?? null)
          : existing.accountId;
        const nextAmount = hasAmount
          ? Number((rest as { amount?: number }).amount)
          : existing.amount;

        const nextAccountName = nextAccountId
          ? await this.resolveAccountName(tx, nextAccountId)
          : null;

        const updateData: Record<string, unknown> = {
          ...rest,
          ...(date ? { date: date.toISOString().split('T')[0] } : null),
          notes: (rest as { notes?: string | null }).notes ?? undefined,
        };

        if (hasAccountId) {
          updateData.accountId = nextAccountId;
          updateData.account = nextAccountName;
        } else if (hasAccountText) {
          const value = (rest as { account?: string | null }).account;
          updateData.account = value ?? null;
        }

        if (existing.accountId === nextAccountId) {
          if (nextAccountId) {
            const delta = nextAmount - existing.amount;
            if (delta !== 0) {
              await tx.householdAccount.update({
                where: { id: nextAccountId },
                data: { balance: { increment: delta } },
              });
            }
          }
        } else {
          if (existing.accountId) {
            await tx.householdAccount.update({
              where: { id: existing.accountId },
              data: { balance: { decrement: existing.amount } },
            });
          }
          if (nextAccountId) {
            await tx.householdAccount.update({
              where: { id: nextAccountId },
              data: { balance: { increment: nextAmount } },
            });
          }
        }

        const updated = await tx.householdIncome.update({
          where: { id },
          data: updateData,
        });

        return updated;
      });
    } catch (error) {
      logger.error('Failed to update household income', { error, id, data });
      throw new Error('Failed to update household income');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.householdIncome.findUnique({
          where: { id },
          select: { id: true, amount: true, accountId: true },
        });
        if (!existing) {
          return;
        }

        await tx.householdIncome.delete({ where: { id } });

        if (existing.accountId) {
          await tx.householdAccount.update({
            where: { id: existing.accountId },
            data: { balance: { decrement: existing.amount } },
          });
        }
      });
    } catch (error) {
      logger.error('Failed to delete household income', { error, id });
      throw new Error('Failed to delete household income');
    }
  }
}

export const householdIncomeService = new HouseholdIncomeService();
