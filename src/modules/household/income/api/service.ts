/**
 * Household Income Service
 *
 * Business logic layer for household/personal income records.
 */

import type { HouseholdIncome } from '@prisma/client';
import { householdIncomeRepository } from './repository';
import type {
  HouseholdIncomeCreateDbInput,
  HouseholdIncomeCreateInput,
  HouseholdIncomeUpdateInput,
  HouseholdIncomeQuery,
} from './schemas';
import { logger } from '@/lib/logger';

export class HouseholdIncomeService {
  private normalizeCreateInput(
    data: HouseholdIncomeCreateInput
  ): HouseholdIncomeCreateDbInput {
    return {
      date: data.date.toISOString().split('T')[0],
      type: data.type,
      amount: data.amount,
      account: data.account ?? undefined,
      notes: data.notes ?? undefined,
    };
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await householdIncomeRepository.create(incomeData as any);
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

      const updateData: Partial<HouseholdIncomeCreateDbInput> = {
        ...rest,
        ...(date ? { date: date.toISOString().split('T')[0] } : null),
        account: rest.account ?? undefined,
        notes: rest.notes ?? undefined,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await householdIncomeRepository.update(id, updateData as any);
    } catch (error) {
      logger.error('Failed to update household income', { error, id, data });
      throw new Error('Failed to update household income');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await householdIncomeRepository.delete(id);
    } catch (error) {
      logger.error('Failed to delete household income', { error, id });
      throw new Error('Failed to delete household income');
    }
  }
}

export const householdIncomeService = new HouseholdIncomeService();
