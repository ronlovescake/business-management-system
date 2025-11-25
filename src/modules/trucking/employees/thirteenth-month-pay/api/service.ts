/**
 * Thirteenth Month Pay Service
 *
 * Business logic layer for 13th month pay management
 *
 * Note: This file contains 'as any' type assertions due to incompatibility between
 * BaseRepository's generic types and Prisma's strict input types. This is an
 * architectural limitation that would require refactoring BaseRepository to resolve.
 * The eslint warnings are accepted as unavoidable in this context.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { TruckingThirteenthMonthPayRecord } from '@prisma/client';
import { thirteenthMonthPayRepository } from './repository';
import type {
  ThirteenthMonthPayCreateInput,
  ThirteenthMonthPayUpdateInput,
  ThirteenthMonthPayQuery,
} from './schemas';
import { logger } from '@/lib/logger';

/**
 * Service class for 13th month pay operations
 */
export class ThirteenthMonthPayService {
  /**
   * Find all records
   */
  async findAll(): Promise<TruckingThirteenthMonthPayRecord[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await thirteenthMonthPayRepository.findMany({
        orderBy: [{ employeeName: 'asc' }, { year: 'desc' }],
      } as any);
    } catch (error) {
      logger.error('Failed to fetch 13th month pay records', { error });
      throw new Error('Failed to fetch records');
    }
  }

  /**
   * Find records with filters
   */
  async findWithFilters(
    filters: ThirteenthMonthPayQuery
  ): Promise<TruckingThirteenthMonthPayRecord[]> {
    try {
      return await thirteenthMonthPayRepository.findWithFilters(filters);
    } catch (error) {
      logger.error('Failed to fetch 13th month pay records with filters', {
        error,
        filters,
      });
      throw new Error('Failed to fetch records');
    }
  }

  /**
   * Find by ID
   */
  async findById(id: string): Promise<TruckingThirteenthMonthPayRecord | null> {
    try {
      return await thirteenthMonthPayRepository.findById(id);
    } catch (error) {
      logger.error('Failed to fetch 13th month pay record', { error, id });
      throw new Error('Failed to fetch record');
    }
  }

  /**
   * Find by record ID
   */
  async findByRecordId(
    recordId: string
  ): Promise<TruckingThirteenthMonthPayRecord | null> {
    try {
      return await thirteenthMonthPayRepository.findByRecordId(recordId);
    } catch (error) {
      logger.error('Failed to fetch 13th month pay record by recordId', {
        error,
        recordId,
      });
      throw new Error('Failed to fetch record');
    }
  }

  /**
   * Create a new record
   */
  async create(
    data: ThirteenthMonthPayCreateInput
  ): Promise<TruckingThirteenthMonthPayRecord> {
    try {
      // Type assertion needed due to Prisma Decimal type complexity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await thirteenthMonthPayRepository.create(data as any);
    } catch (error) {
      logger.error('Failed to create 13th month pay record', { error, data });
      throw new Error('Failed to create record');
    }
  }

  /**
   * Create multiple records (batch)
   */
  async createMany(
    data: ThirteenthMonthPayCreateInput[]
  ): Promise<{ count: number }> {
    try {
      // Type assertion needed due to Prisma Decimal type complexity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await thirteenthMonthPayRepository.createMany(data as any);
    } catch (error) {
      logger.error('Failed to create 13th month pay records', {
        error,
        count: data.length,
      });
      throw new Error('Failed to create records');
    }
  }

  /**
   * Update a record
   */
  async update(
    id: string,
    data: Partial<ThirteenthMonthPayUpdateInput>
  ): Promise<TruckingThirteenthMonthPayRecord> {
    try {
      const existing = await thirteenthMonthPayRepository.findById(id);
      if (!existing) {
        throw new Error(`Record with ID ${id} not found`);
      }

      const { id: _, ...updateData } = data;

      // Type assertion needed due to Prisma Decimal type complexity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await thirteenthMonthPayRepository.update(id, updateData as any);
    } catch (error) {
      logger.error('Failed to update 13th month pay record', {
        error,
        id,
        data,
      });
      throw error;
    }
  }

  /**
   * Update status by record ID
   */
  async updateStatusByRecordId(
    recordId: string,
    status: string
  ): Promise<TruckingThirteenthMonthPayRecord> {
    try {
      const record = await this.findByRecordId(recordId);
      if (!record) {
        throw new Error(`Record with recordId ${recordId} not found`);
      }

      const updateData: Record<string, string> = { status };

      // Update date fields based on status
      if (status === 'approved' && !record.approvedDate) {
        updateData.approvedDate = new Date().toISOString();
      } else if (status === 'paid' && !record.paidDate) {
        updateData.paidDate = new Date().toISOString();
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await thirteenthMonthPayRepository.update(
        record.id,
        updateData as any
      );
    } catch (error) {
      logger.error('Failed to update status', { error, recordId, status });
      throw error;
    }
  }

  /**
   * Delete a record
   */
  async delete(id: string): Promise<void> {
    try {
      await thirteenthMonthPayRepository.delete(id);
      logger.info('13th month pay record deleted', { id });
    } catch (error) {
      logger.error('Failed to delete 13th month pay record', { error, id });
      throw new Error('Failed to delete record');
    }
  }

  /**
   * Delete all records
   */
  async deleteAll(): Promise<{ count: number }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = await thirteenthMonthPayRepository.findMany({} as any);
      let count = 0;

      for (const record of records) {
        await thirteenthMonthPayRepository.delete(record.id);
        count++;
      }

      logger.warn('All 13th month pay records deleted', { count });
      return { count };
    } catch (error) {
      logger.error('Failed to delete all 13th month pay records', { error });
      throw new Error('Failed to delete all records');
    }
  }

  /**
   * Find by employee ID
   */
  async findByEmployeeId(
    employeeId: string
  ): Promise<TruckingThirteenthMonthPayRecord[]> {
    try {
      return await thirteenthMonthPayRepository.findByEmployeeId(employeeId);
    } catch (error) {
      logger.error('Failed to fetch records by employee', {
        error,
        employeeId,
      });
      throw new Error('Failed to fetch records');
    }
  }

  /**
   * Find by year
   */
  async findByYear(year: number): Promise<TruckingThirteenthMonthPayRecord[]> {
    try {
      return await thirteenthMonthPayRepository.findByYear(year);
    } catch (error) {
      logger.error('Failed to fetch records by year', { error, year });
      throw new Error('Failed to fetch records');
    }
  }

  /**
   * Find by status
   */
  async findByStatus(
    status: string
  ): Promise<TruckingThirteenthMonthPayRecord[]> {
    try {
      return await thirteenthMonthPayRepository.findByStatus(status);
    } catch (error) {
      logger.error('Failed to fetch records by status', { error, status });
      throw new Error('Failed to fetch records');
    }
  }

  /**
   * Get statistics by status
   */
  async getStatsByStatus(): Promise<
    Array<{ status: string; total: number; count: number }>
  > {
    try {
      return await thirteenthMonthPayRepository.getTotalByStatus();
    } catch (error) {
      logger.error('Failed to fetch statistics by status', { error });
      throw new Error('Failed to fetch statistics');
    }
  }

  /**
   * Get statistics by year
   */
  async getStatsByYear(): Promise<
    Array<{ year: number; total: number; count: number }>
  > {
    try {
      return await thirteenthMonthPayRepository.getTotalByYear();
    } catch (error) {
      logger.error('Failed to fetch statistics by year', { error });
      throw new Error('Failed to fetch statistics');
    }
  }
}

// Singleton instance
export const thirteenthMonthPayService = new ThirteenthMonthPayService();
