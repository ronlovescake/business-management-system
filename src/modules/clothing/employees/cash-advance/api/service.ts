/**
 * Cash Advance Service
 *
 * Business logic layer for cash advance management
 */

import type { CashAdvanceRecord } from '@prisma/client';
import { cashAdvanceRepository } from './repository';
import type {
  CashAdvanceCreateInput,
  CashAdvanceUpdateInput,
  CashAdvanceQuery,
} from './schemas';
import { logger } from '@/lib/logger';

/**
 * Service class for cash advance operations
 */
export class CashAdvanceService {
  /**
   * Find all cash advances
   */
  async findAll(): Promise<CashAdvanceRecord[]> {
    try {
      // Empty object passed as filter to retrieve all records
      // Type assertion needed due to BaseRepository's generic constraints
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await cashAdvanceRepository.findMany({} as any);
    } catch (error) {
      logger.error('Failed to fetch cash advances', { error });
      throw new Error('Failed to fetch cash advances');
    }
  }

  /**
   * Find cash advances with filters
   */
  async findWithFilters(
    filters: CashAdvanceQuery
  ): Promise<CashAdvanceRecord[]> {
    try {
      return await cashAdvanceRepository.findWithFilters(filters);
    } catch (error) {
      logger.error('Failed to fetch cash advances with filters', {
        error,
        filters,
      });
      throw new Error('Failed to fetch cash advances');
    }
  }

  /**
   * Find cash advance by ID
   */
  async findById(id: string): Promise<CashAdvanceRecord | null> {
    try {
      return await cashAdvanceRepository.findById(id);
    } catch (error) {
      logger.error('Failed to fetch cash advance', { error, id });
      throw new Error('Failed to fetch cash advance');
    }
  }

  /**
   * Create a new cash advance
   */
  async create(data: CashAdvanceCreateInput): Promise<CashAdvanceRecord> {
    try {
      // Type assertion needed: Zod-validated input structure matches database schema
      // but type system cannot verify due to BaseRepository's generic constraints
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await cashAdvanceRepository.create(data as any);
    } catch (error) {
      logger.error('Failed to create cash advance', { error, data });
      throw new Error('Failed to create cash advance');
    }
  }

  /**
   * Create multiple cash advances (batch)
   */
  async createMany(data: CashAdvanceCreateInput[]): Promise<{ count: number }> {
    try {
      // Type assertion needed: Zod-validated input array matches database schema
      // but type system cannot verify due to BaseRepository's generic constraints
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await cashAdvanceRepository.createMany(data as any);
    } catch (error) {
      logger.error('Failed to create cash advances', {
        error,
        count: data.length,
      });
      throw new Error('Failed to create cash advances');
    }
  }

  /**
   * Update a cash advance
   */
  async update(
    id: string,
    data: Partial<CashAdvanceUpdateInput>
  ): Promise<CashAdvanceRecord> {
    try {
      // Check if cash advance exists
      const existing = await cashAdvanceRepository.findById(id);
      if (!existing) {
        throw new Error(`Cash advance with ID ${id} not found`);
      }

      // Remove id from update data
      const { id: _, ...updateData } = data;

      // Type assertion needed: Update data structure matches database schema
      // but type system cannot verify due to BaseRepository's generic constraints
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await cashAdvanceRepository.update(id, updateData as any);
    } catch (error) {
      logger.error('Failed to update cash advance', { error, id, data });
      throw error;
    }
  }

  /**
   * Update multiple cash advances
   */
  async updateMany(
    updates: Array<{ id: string; data: Partial<CashAdvanceUpdateInput> }>
  ): Promise<CashAdvanceRecord[]> {
    try {
      const results = await Promise.all(
        updates.map(({ id, data }) => this.update(id, data))
      );
      return results;
    } catch (error) {
      logger.error('Failed to update cash advances', {
        error,
        count: updates.length,
      });
      throw new Error('Failed to update cash advances');
    }
  }

  /**
   * Delete a cash advance
   */
  async delete(id: string): Promise<void> {
    try {
      await cashAdvanceRepository.delete(id);
      logger.info('Cash advance deleted', { id });
    } catch (error) {
      logger.error('Failed to delete cash advance', { error, id });
      throw new Error('Failed to delete cash advance');
    }
  }

  /**
   * Delete all cash advances
   */
  async deleteAll(): Promise<{ count: number }> {
    try {
      // Empty object passed as filter to retrieve all records
      // Type assertion needed due to BaseRepository's generic constraints
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cashAdvances = await cashAdvanceRepository.findMany({} as any);
      let count = 0;

      for (const cashAdvance of cashAdvances) {
        await cashAdvanceRepository.delete(cashAdvance.id);
        count++;
      }

      logger.warn('All cash advances deleted', { count });
      return { count };
    } catch (error) {
      logger.error('Failed to delete all cash advances', { error });
      throw new Error('Failed to delete all cash advances');
    }
  }

  /**
   * Find cash advances by employee ID
   */
  async findByEmployeeId(employeeId: string): Promise<CashAdvanceRecord[]> {
    try {
      return await cashAdvanceRepository.findByEmployeeId(employeeId);
    } catch (error) {
      logger.error('Failed to fetch cash advances by employee', {
        error,
        employeeId,
      });
      throw new Error('Failed to fetch cash advances');
    }
  }

  /**
   * Find cash advances by employee name
   */
  async findByEmployeeName(name: string): Promise<CashAdvanceRecord[]> {
    try {
      return await cashAdvanceRepository.findByEmployeeName(name);
    } catch (error) {
      logger.error('Failed to fetch cash advances by name', { error, name });
      throw new Error('Failed to fetch cash advances');
    }
  }

  /**
   * Find cash advances by status
   */
  async findByStatus(status: string): Promise<CashAdvanceRecord[]> {
    try {
      return await cashAdvanceRepository.findByStatus(status);
    } catch (error) {
      logger.error('Failed to fetch cash advances by status', {
        error,
        status,
      });
      throw new Error('Failed to fetch cash advances');
    }
  }

  /**
   * Find cash advances with remaining balance
   */
  async findWithBalance(): Promise<CashAdvanceRecord[]> {
    try {
      return await cashAdvanceRepository.findWithBalance();
    } catch (error) {
      logger.error('Failed to fetch cash advances with balance', { error });
      throw new Error('Failed to fetch cash advances');
    }
  }

  /**
   * Get statistics by status
   */
  async getStatsByStatus(): Promise<
    Array<{ status: string; total: number; count: number }>
  > {
    try {
      return await cashAdvanceRepository.getTotalByStatus();
    } catch (error) {
      logger.error('Failed to fetch statistics by status', { error });
      throw new Error('Failed to fetch statistics');
    }
  }

  /**
   * Get total outstanding balance
   */
  async getTotalOutstanding(): Promise<number> {
    try {
      return await cashAdvanceRepository.getTotalOutstanding();
    } catch (error) {
      logger.error('Failed to fetch total outstanding', { error });
      throw new Error('Failed to fetch total outstanding');
    }
  }
}

// Singleton instance
export const cashAdvanceService = new CashAdvanceService();
