/* eslint-disable @typescript-eslint/no-explicit-any */

import { logger } from '@/lib/logger';

type ThirteenthMonthPayRepositoryLike<
  TEntity,
  TCreateInput,
  TUpdateInput,
  TQuery,
> = {
  findMany(options?: unknown): Promise<TEntity[]>;
  findWithFilters(filters: TQuery): Promise<TEntity[]>;
  findById(id: string): Promise<TEntity | null>;
  findByRecordId(recordId: string): Promise<TEntity | null>;
  create(data: TCreateInput): Promise<TEntity>;
  createMany(data: TCreateInput[]): Promise<{ count: number }>;
  update(id: string, data: TUpdateInput): Promise<TEntity>;
  delete(id: string): Promise<TEntity>;
  findByEmployeeId(employeeId: string): Promise<TEntity[]>;
  findByYear(year: number): Promise<TEntity[]>;
  findByStatus(status: string): Promise<TEntity[]>;
  getTotalByStatus(): Promise<
    Array<{ status: string; total: number; count: number }>
  >;
  getTotalByYear(): Promise<
    Array<{ year: number; total: number; count: number }>
  >;
};

type DatedStatusRecord = {
  id: string;
  approvedDate?: string | null;
  paidDate?: string | null;
};

export class ThirteenthMonthPayServiceBase<
  TEntity extends DatedStatusRecord,
  TCreateInput,
  TUpdateInput extends { id?: string },
  TQuery,
> {
  private readonly repository: ThirteenthMonthPayRepositoryLike<
    TEntity,
    TCreateInput,
    TUpdateInput,
    TQuery
  >;

  constructor(
    repository: ThirteenthMonthPayRepositoryLike<
      TEntity,
      TCreateInput,
      TUpdateInput,
      TQuery
    >
  ) {
    this.repository = repository;
  }

  async findAll(): Promise<TEntity[]> {
    try {
      return await this.repository.findMany({
        orderBy: [{ employeeName: 'asc' }, { year: 'desc' }],
      } as any);
    } catch (error) {
      logger.error('Failed to fetch 13th month pay records', { error });
      throw new Error('Failed to fetch records');
    }
  }

  async findWithFilters(filters: TQuery): Promise<TEntity[]> {
    try {
      return await this.repository.findWithFilters(filters);
    } catch (error) {
      logger.error('Failed to fetch 13th month pay records with filters', {
        error,
        filters,
      });
      throw new Error('Failed to fetch records');
    }
  }

  async findById(id: string): Promise<TEntity | null> {
    try {
      return await this.repository.findById(id);
    } catch (error) {
      logger.error('Failed to fetch 13th month pay record', { error, id });
      throw new Error('Failed to fetch record');
    }
  }

  async findByRecordId(recordId: string): Promise<TEntity | null> {
    try {
      return await this.repository.findByRecordId(recordId);
    } catch (error) {
      logger.error('Failed to fetch 13th month pay record by recordId', {
        error,
        recordId,
      });
      throw new Error('Failed to fetch record');
    }
  }

  async create(data: TCreateInput): Promise<TEntity> {
    try {
      return await this.repository.create(data as any);
    } catch (error) {
      logger.error('Failed to create 13th month pay record', { error, data });
      throw new Error('Failed to create record');
    }
  }

  async createMany(data: TCreateInput[]): Promise<{ count: number }> {
    try {
      return await this.repository.createMany(data as any);
    } catch (error) {
      logger.error('Failed to create 13th month pay records', {
        error,
        count: data.length,
      });
      throw new Error('Failed to create records');
    }
  }

  async update(id: string, data: Partial<TUpdateInput>): Promise<TEntity> {
    try {
      const existing = await this.repository.findById(id);
      if (!existing) {
        throw new Error(`Record with ID ${id} not found`);
      }

      const { id: _, ...updateData } = data;
      return await this.repository.update(id, updateData as TUpdateInput);
    } catch (error) {
      logger.error('Failed to update 13th month pay record', {
        error,
        id,
        data,
      });
      throw error;
    }
  }

  async updateStatusByRecordId(
    recordId: string,
    status: string
  ): Promise<TEntity> {
    try {
      const record = await this.findByRecordId(recordId);
      if (!record) {
        throw new Error(`Record with recordId ${recordId} not found`);
      }

      const updateData: Record<string, string> = { status };
      if (status === 'approved' && !record.approvedDate) {
        updateData.approvedDate = new Date().toISOString();
      } else if (status === 'paid' && !record.paidDate) {
        updateData.paidDate = new Date().toISOString();
      }

      return await this.repository.update(
        record.id,
        updateData as TUpdateInput
      );
    } catch (error) {
      logger.error('Failed to update status', { error, recordId, status });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.repository.delete(id);
      logger.info('13th month pay record deleted', { id });
    } catch (error) {
      logger.error('Failed to delete 13th month pay record', { error, id });
      throw new Error('Failed to delete record');
    }
  }

  async deleteAll(): Promise<{ count: number }> {
    try {
      const records = await this.repository.findMany({} as any);
      let count = 0;
      for (const record of records) {
        await this.repository.delete(record.id);
        count++;
      }

      logger.warn('All 13th month pay records deleted', { count });
      return { count };
    } catch (error) {
      logger.error('Failed to delete all 13th month pay records', { error });
      throw new Error('Failed to delete all records');
    }
  }

  async findByEmployeeId(employeeId: string): Promise<TEntity[]> {
    try {
      return await this.repository.findByEmployeeId(employeeId);
    } catch (error) {
      logger.error('Failed to fetch records by employee', {
        error,
        employeeId,
      });
      throw new Error('Failed to fetch records');
    }
  }

  async findByYear(year: number): Promise<TEntity[]> {
    try {
      return await this.repository.findByYear(year);
    } catch (error) {
      logger.error('Failed to fetch records by year', { error, year });
      throw new Error('Failed to fetch records');
    }
  }

  async findByStatus(status: string): Promise<TEntity[]> {
    try {
      return await this.repository.findByStatus(status);
    } catch (error) {
      logger.error('Failed to fetch records by status', { error, status });
      throw new Error('Failed to fetch records');
    }
  }

  async getStatsByStatus(): Promise<
    Array<{ status: string; total: number; count: number }>
  > {
    try {
      return await this.repository.getTotalByStatus();
    } catch (error) {
      logger.error('Failed to fetch statistics by status', { error });
      throw new Error('Failed to fetch statistics');
    }
  }

  async getStatsByYear(): Promise<
    Array<{ year: number; total: number; count: number }>
  > {
    try {
      return await this.repository.getTotalByYear();
    } catch (error) {
      logger.error('Failed to fetch statistics by year', { error });
      throw new Error('Failed to fetch statistics');
    }
  }
}
