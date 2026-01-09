/**
 * Household Accounts Service
 *
 * Business logic layer for household/personal accounts.
 */

import type { HouseholdAccount } from '@prisma/client';
import { householdAccountRepository } from './repository';
import type {
  HouseholdAccountCreateDbInput,
  HouseholdAccountCreateInput,
  HouseholdAccountUpdateInput,
  HouseholdAccountQuery,
} from './schemas';
import { logger } from '@/lib/logger';

export class HouseholdAccountService {
  private normalizeCreateInput(
    data: HouseholdAccountCreateInput
  ): HouseholdAccountCreateDbInput {
    return {
      name: data.name.trim(),
      type: data.type,
      institution: data.institution ?? undefined,
      accountNumberLast4: data.accountNumberLast4 ?? undefined,
      isActive: data.isActive ?? true,
      balance: Number.isFinite(data.balance) ? data.balance : 0,
    };
  }

  async findAll(): Promise<HouseholdAccount[]> {
    try {
      return await householdAccountRepository.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to fetch household accounts', { error });
      throw new Error('Failed to fetch household accounts');
    }
  }

  async findWithFilters(
    filters: HouseholdAccountQuery
  ): Promise<HouseholdAccount[]> {
    try {
      return await householdAccountRepository.findWithFilters(filters);
    } catch (error) {
      logger.error('Failed to fetch household accounts with filters', {
        error,
        filters,
      });
      throw new Error('Failed to fetch household accounts');
    }
  }

  async create(data: HouseholdAccountCreateInput): Promise<HouseholdAccount> {
    try {
      const accountData = this.normalizeCreateInput(data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await householdAccountRepository.create(accountData as any);
    } catch (error) {
      logger.error('Failed to create household account', { error, data });
      throw new Error('Failed to create household account');
    }
  }

  async createMany(
    data: HouseholdAccountCreateInput[]
  ): Promise<{ count: number }> {
    try {
      const accounts = data.map((account) =>
        this.normalizeCreateInput(account)
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await householdAccountRepository.createMany(accounts as any);
    } catch (error) {
      logger.error('Failed to create household accounts', {
        error,
        count: data.length,
      });
      throw new Error('Failed to create household accounts');
    }
  }

  async update(
    id: string,
    data: Partial<HouseholdAccountUpdateInput>
  ): Promise<HouseholdAccount> {
    try {
      const { id: _, ...updateData } = data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await householdAccountRepository.update(id, updateData as any);
    } catch (error) {
      logger.error('Failed to update household account', { error, id, data });
      throw new Error('Failed to update household account');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await householdAccountRepository.delete(id);
    } catch (error) {
      logger.error('Failed to delete household account', { error, id });
      throw new Error('Failed to delete household account');
    }
  }
}

export const householdAccountService = new HouseholdAccountService();
