import { logger } from '@/lib/logger';

type CashAdvanceRepositoryLike<TEntity, TCreateInput, TUpdateInput, TQuery> = {
  findMany(options?: unknown): Promise<TEntity[]>;
  findWithFilters(filters: TQuery): Promise<TEntity[]>;
  findById(id: string): Promise<TEntity | null>;
  create(data: TCreateInput): Promise<TEntity>;
  createMany(data: TCreateInput[]): Promise<{ count: number }>;
  update(id: string, data: TUpdateInput): Promise<TEntity>;
  delete(id: string): Promise<TEntity>;
  findByEmployeeId(employeeId: string): Promise<TEntity[]>;
  findByEmployeeName(name: string): Promise<TEntity[]>;
  findByStatus(status: string): Promise<TEntity[]>;
  findWithBalance(): Promise<TEntity[]>;
  getTotalByStatus(): Promise<
    Array<{ status: string; total: number; count: number }>
  >;
  getTotalOutstanding(): Promise<number>;
};

export class CashAdvanceServiceBase<
  TEntity extends { id: string },
  TCreateInput,
  TUpdateInput extends { id?: string },
  TQuery,
> {
  private readonly repository: CashAdvanceRepositoryLike<
    TEntity,
    TCreateInput,
    TUpdateInput,
    TQuery
  >;

  constructor(
    repository: CashAdvanceRepositoryLike<
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
      return await this.repository.findMany();
    } catch (error) {
      logger.error('Failed to fetch cash advances', { error });
      throw new Error('Failed to fetch cash advances');
    }
  }

  async findWithFilters(filters: TQuery): Promise<TEntity[]> {
    try {
      return await this.repository.findWithFilters(filters);
    } catch (error) {
      logger.error('Failed to fetch cash advances with filters', {
        error,
        filters,
      });
      throw new Error('Failed to fetch cash advances');
    }
  }

  async findById(id: string): Promise<TEntity | null> {
    try {
      return await this.repository.findById(id);
    } catch (error) {
      logger.error('Failed to fetch cash advance', { error, id });
      throw new Error('Failed to fetch cash advance');
    }
  }

  async create(data: TCreateInput): Promise<TEntity> {
    try {
      return await this.repository.create(data);
    } catch (error) {
      logger.error('Failed to create cash advance', { error, data });
      throw new Error('Failed to create cash advance');
    }
  }

  async createMany(data: TCreateInput[]): Promise<{ count: number }> {
    try {
      return await this.repository.createMany(data);
    } catch (error) {
      logger.error('Failed to create cash advances', {
        error,
        count: data.length,
      });
      throw new Error('Failed to create cash advances');
    }
  }

  async update(id: string, data: Partial<TUpdateInput>): Promise<TEntity> {
    try {
      const existing = await this.repository.findById(id);
      if (!existing) {
        throw new Error(`Cash advance with ID ${id} not found`);
      }

      const { id: _, ...updateData } = data;
      return await this.repository.update(id, updateData as TUpdateInput);
    } catch (error) {
      logger.error('Failed to update cash advance', { error, id, data });
      throw error;
    }
  }

  async updateMany(
    updates: Array<{ id: string; data: Partial<TUpdateInput> }>
  ): Promise<TEntity[]> {
    try {
      return await Promise.all(
        updates.map(({ id, data }) => this.update(id, data))
      );
    } catch (error) {
      logger.error('Failed to update cash advances', {
        error,
        count: updates.length,
      });
      throw new Error('Failed to update cash advances');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.repository.delete(id);
      logger.info('Cash advance deleted', { id });
    } catch (error) {
      logger.error('Failed to delete cash advance', { error, id });
      throw new Error('Failed to delete cash advance');
    }
  }

  async deleteAll(): Promise<{ count: number }> {
    try {
      const cashAdvances = await this.repository.findMany();
      let count = 0;

      for (const cashAdvance of cashAdvances) {
        await this.repository.delete(cashAdvance.id);
        count++;
      }

      logger.warn('All cash advances deleted', { count });
      return { count };
    } catch (error) {
      logger.error('Failed to delete all cash advances', { error });
      throw new Error('Failed to delete all cash advances');
    }
  }

  async findByEmployeeId(employeeId: string): Promise<TEntity[]> {
    try {
      return await this.repository.findByEmployeeId(employeeId);
    } catch (error) {
      logger.error('Failed to fetch cash advances by employee', {
        error,
        employeeId,
      });
      throw new Error('Failed to fetch cash advances');
    }
  }

  async findByEmployeeName(name: string): Promise<TEntity[]> {
    try {
      return await this.repository.findByEmployeeName(name);
    } catch (error) {
      logger.error('Failed to fetch cash advances by name', { error, name });
      throw new Error('Failed to fetch cash advances');
    }
  }

  async findByStatus(status: string): Promise<TEntity[]> {
    try {
      return await this.repository.findByStatus(status);
    } catch (error) {
      logger.error('Failed to fetch cash advances by status', {
        error,
        status,
      });
      throw new Error('Failed to fetch cash advances');
    }
  }

  async findWithBalance(): Promise<TEntity[]> {
    try {
      return await this.repository.findWithBalance();
    } catch (error) {
      logger.error('Failed to fetch cash advances with balance', { error });
      throw new Error('Failed to fetch cash advances');
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

  async getTotalOutstanding(): Promise<number> {
    try {
      return await this.repository.getTotalOutstanding();
    } catch (error) {
      logger.error('Failed to fetch total outstanding', { error });
      throw new Error('Failed to fetch total outstanding');
    }
  }
}
