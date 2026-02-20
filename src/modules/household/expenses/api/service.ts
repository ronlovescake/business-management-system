/**
 * Household Expense Service
 *
 * Business logic layer for household/personal expense management
 */

import { Prisma } from '@prisma/client';
import type { HouseholdExpense } from '@prisma/client';
import { householdExpenseRepository } from './repository';
import type {
  HouseholdExpenseCreateInput,
  HouseholdExpenseUpdateInput,
  HouseholdExpenseQuery,
  HouseholdExpenseCreateDbInput,
} from './schemas';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';

export class HouseholdExpenseService {
  private statusImpactsBalance(status?: string | null): boolean {
    return status === 'approved' || status === 'paid';
  }

  private async resolveAccountName(
    tx: Prisma.TransactionClient,
    accountId: string
  ): Promise<void> {
    const account = await tx.householdAccount.findUnique({
      where: { id: accountId },
      select: { id: true },
    });
    if (!account) {
      throw new Error(`Household account ${accountId} not found`);
    }
  }

  private normalizeSourceFields(
    data: Partial<HouseholdExpenseCreateInput>
  ): Pick<
    HouseholdExpenseCreateDbInput,
    'sourceType' | 'sourceId' | 'sourceLineKey' | 'systemGenerated'
  > {
    const sourceType = (data.sourceType ?? 'MANUAL').toUpperCase();

    const toNullable = (value?: string | null) => {
      if (value === undefined || value === null) {
        return null;
      }
      const trimmed = String(value).trim();
      return trimmed.length === 0 ? null : trimmed;
    };

    return {
      sourceType,
      sourceId: toNullable(data.sourceId),
      sourceLineKey: toNullable(data.sourceLineKey),
      systemGenerated: data.systemGenerated ?? false,
    };
  }

  private normalizePaymentFields(
    data: Partial<HouseholdExpenseCreateInput>
  ): Pick<HouseholdExpenseCreateDbInput, 'paymentMethod' | 'paymentCardId'> {
    const toOptional = (value?: string | null) => {
      if (value === undefined || value === null) {
        return undefined;
      }
      const trimmed = String(value).trim();
      return trimmed.length === 0 ? undefined : trimmed;
    };

    return {
      paymentMethod: toOptional(data.paymentMethod),
      paymentCardId: toOptional(data.paymentCardId),
    };
  }

  private normalizeCreateInput(
    data: HouseholdExpenseCreateInput
  ): HouseholdExpenseCreateDbInput {
    const sourceFields = this.normalizeSourceFields(data);
    const paymentFields = this.normalizePaymentFields(data);

    return {
      ...data,
      ...sourceFields,
      ...paymentFields,
      date: data.date.toISOString().split('T')[0],
      receipt: data.receipt ?? undefined,
      notes: data.notes ?? undefined,
      loggedBy: data.loggedBy === undefined ? undefined : data.loggedBy,
      accountId: data.accountId ?? undefined,
    };
  }

  async findAll(): Promise<HouseholdExpense[]> {
    try {
      return await householdExpenseRepository.findMany({
        orderBy: { date: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to fetch household expenses', { error });
      throw new Error('Failed to fetch household expenses');
    }
  }

  async findWithFilters(
    filters: HouseholdExpenseQuery
  ): Promise<HouseholdExpense[]> {
    try {
      return await householdExpenseRepository.findWithFilters(filters);
    } catch (error) {
      logger.error('Failed to fetch filtered household expenses', {
        error,
        filters,
      });
      throw new Error('Failed to fetch filtered household expenses');
    }
  }

  async findById(id: number): Promise<HouseholdExpense | null> {
    try {
      return await householdExpenseRepository.findById(id);
    } catch (error) {
      logger.error('Failed to fetch household expense', { error, id });
      throw new Error('Failed to fetch household expense');
    }
  }

  async create(data: HouseholdExpenseCreateInput): Promise<HouseholdExpense> {
    try {
      const expenseData = this.normalizeCreateInput(data);

      return await prisma.$transaction(async (tx) => {
        const accountId = expenseData.accountId ?? null;
        if (accountId) {
          await this.resolveAccountName(tx, accountId);
        }

        const created = await tx.householdExpense.create({
          data: {
            ...expenseData,
            accountId,
          },
        });

        const shouldImpact = this.statusImpactsBalance(created.status);
        if (shouldImpact && accountId) {
          await tx.householdAccount.update({
            where: { id: accountId },
            data: { balance: { decrement: created.amount } },
          });
        }

        return created;
      });
    } catch (error) {
      logger.error('Failed to create household expense', { error, data });
      throw new Error('Failed to create household expense');
    }
  }

  async createMany(
    data: HouseholdExpenseCreateInput[]
  ): Promise<{ count: number }> {
    try {
      const expenses = data.map((expense) =>
        this.normalizeCreateInput(expense)
      );

      return await prisma.$transaction(async (tx) => {
        const accountIds = Array.from(
          new Set(
            expenses
              .map((expense) => expense.accountId)
              .filter((id): id is string => Boolean(id))
          )
        );

        if (accountIds.length > 0) {
          const accounts = await tx.householdAccount.findMany({
            where: { id: { in: accountIds } },
            select: { id: true },
          });

          const foundAccounts = new Set(accounts.map((account) => account.id));
          const missingAccounts = accountIds.filter(
            (id) => !foundAccounts.has(id)
          );

          if (missingAccounts.length > 0) {
            throw new Error(
              `Household account(s) not found: ${missingAccounts.join(', ')}`
            );
          }
        }

        let createdCount = 0;

        for (const expense of expenses) {
          try {
            const created = await tx.householdExpense.create({
              data: {
                ...expense,
                accountId: expense.accountId ?? null,
              },
            });

            if (
              created.accountId &&
              this.statusImpactsBalance(created.status)
            ) {
              await tx.householdAccount.update({
                where: { id: created.accountId },
                data: { balance: { decrement: created.amount } },
              });
            }

            createdCount += 1;
          } catch (error) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2002'
            ) {
              logger.warn('Skipping duplicate household expense', {
                code: error.code,
                data: expense,
              });
              continue;
            }
            throw error;
          }
        }

        return { count: createdCount };
      });
    } catch (error) {
      logger.error('Failed to create household expenses', {
        error,
        count: data.length,
      });
      throw new Error('Failed to create household expenses');
    }
  }

  async update(
    id: number,
    data: Partial<HouseholdExpenseUpdateInput>
  ): Promise<HouseholdExpense> {
    try {
      const { id: _, ...updateFields } = data;

      return await prisma.$transaction(async (tx) => {
        const existing = await tx.householdExpense.findUnique({
          where: { id },
          select: {
            id: true,
            amount: true,
            status: true,
            accountId: true,
          },
        });
        if (!existing) {
          throw new Error(`Household expense with ID ${id} not found`);
        }

        const updateData: Record<string, unknown> = { ...updateFields };
        if (updateData.date instanceof Date) {
          updateData.date = updateData.date.toISOString().split('T')[0];
        }

        const shouldNormalizeSource =
          'sourceType' in updateData ||
          'sourceId' in updateData ||
          'sourceLineKey' in updateData ||
          'systemGenerated' in updateData;

        if (shouldNormalizeSource) {
          const normalized = this.normalizeSourceFields(updateData);
          if ('sourceType' in updateData) {
            updateData.sourceType = normalized.sourceType;
          }
          if ('sourceId' in updateData) {
            updateData.sourceId = normalized.sourceId;
          }
          if ('sourceLineKey' in updateData) {
            updateData.sourceLineKey = normalized.sourceLineKey;
          }
          if ('systemGenerated' in updateData) {
            updateData.systemGenerated = normalized.systemGenerated;
          }
        }

        const shouldNormalizePayment =
          'paymentMethod' in updateData || 'paymentCardId' in updateData;

        if (shouldNormalizePayment) {
          const normalizedPayment = this.normalizePaymentFields(updateData);
          if ('paymentMethod' in updateData) {
            updateData.paymentMethod = normalizedPayment.paymentMethod ?? null;
          }
          if ('paymentCardId' in updateData) {
            updateData.paymentCardId = normalizedPayment.paymentCardId ?? null;
          }
        }

        const hasAccountId = Object.prototype.hasOwnProperty.call(
          updateData,
          'accountId'
        );
        const hasAmount = Object.prototype.hasOwnProperty.call(
          updateData,
          'amount'
        );
        const hasStatus = Object.prototype.hasOwnProperty.call(
          updateData,
          'status'
        );

        const nextAccountId = hasAccountId
          ? ((updateData as { accountId?: string | null }).accountId ?? null)
          : existing.accountId;
        const nextAmount = hasAmount
          ? Number((updateData as { amount?: number }).amount)
          : existing.amount;
        const nextStatus = hasStatus
          ? ((updateData as { status?: string | null }).status ?? null)
          : existing.status;

        if (hasAccountId && nextAccountId) {
          await this.resolveAccountName(tx, nextAccountId);
        }

        const oldEffect = this.statusImpactsBalance(existing.status)
          ? existing.amount
          : 0;
        const newEffect = this.statusImpactsBalance(nextStatus)
          ? nextAmount
          : 0;

        if (existing.accountId === nextAccountId) {
          if (nextAccountId) {
            const deltaBalance = oldEffect - newEffect;
            if (deltaBalance !== 0) {
              await tx.householdAccount.update({
                where: { id: nextAccountId },
                data: { balance: { increment: deltaBalance } },
              });
            }
          }
        } else {
          if (existing.accountId && oldEffect !== 0) {
            await tx.householdAccount.update({
              where: { id: existing.accountId },
              data: { balance: { increment: oldEffect } },
            });
          }
          if (nextAccountId && newEffect !== 0) {
            await tx.householdAccount.update({
              where: { id: nextAccountId },
              data: { balance: { decrement: newEffect } },
            });
          }
        }

        if (hasAccountId) {
          updateData.accountId = nextAccountId;
        }

        return await tx.householdExpense.update({
          where: { id },
          data: updateData,
        });
      });
    } catch (error) {
      logger.error('Failed to update household expense', { error, id, data });
      throw error;
    }
  }

  async updateMany(
    data: HouseholdExpenseUpdateInput[]
  ): Promise<{ count: number }> {
    try {
      let updated = 0;

      for (const expense of data) {
        if (expense.id) {
          await this.update(expense.id, expense);
          updated++;
        }
      }

      return { count: updated };
    } catch (error) {
      logger.error('Failed to update household expenses', {
        error,
        count: data.length,
      });
      throw new Error('Failed to update household expenses');
    }
  }

  async delete(id: number): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.householdExpense.findUnique({
          where: { id },
          select: { id: true, amount: true, status: true, accountId: true },
        });
        if (!existing) {
          return;
        }

        await tx.householdExpense.delete({ where: { id } });

        const effect = this.statusImpactsBalance(existing.status)
          ? existing.amount
          : 0;

        if (existing.accountId && effect !== 0) {
          await tx.householdAccount.update({
            where: { id: existing.accountId },
            data: { balance: { increment: effect } },
          });
        }
      });
    } catch (error) {
      logger.error('Failed to delete household expense', { error, id });
      throw new Error('Failed to delete household expense');
    }
  }

  async deleteAll(): Promise<{ count: number }> {
    try {
      return await householdExpenseRepository.deleteMany();
    } catch (error) {
      logger.error('Failed to delete household expenses', { error });
      throw new Error('Failed to delete household expenses');
    }
  }

  async upsertBySource(
    data: HouseholdExpenseCreateDbInput
  ): Promise<HouseholdExpense> {
    try {
      return await householdExpenseRepository.upsertBySource(data);
    } catch (error) {
      logger.error('Failed to upsert household expense by source', {
        error,
        data,
      });
      throw new Error('Failed to upsert household expense by source');
    }
  }
}

export const householdExpenseService = new HouseholdExpenseService();
