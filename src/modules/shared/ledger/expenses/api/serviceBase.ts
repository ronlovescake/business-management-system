import { logger } from '@/lib/logger';
import type { WhereInput } from '@/core/database/repository';

type UpsertBySourceLike<TEntity> = {
  upsertBySource(data: unknown): Promise<TEntity>;
};

type ExpenseRepositoryLike<
  TEntity,
  TQuery,
  TNormalizedCreateInput,
  TNormalizedUpdateInput,
> = {
  findMany(options?: unknown): Promise<TEntity[]>;
  findWithFilters(filters: TQuery): Promise<TEntity[]>;
  findById(id: number): Promise<TEntity | null>;
  create(data: TNormalizedCreateInput): Promise<TEntity>;
  createMany(data: TNormalizedCreateInput[]): Promise<{ count: number }>;
  update(id: number, data: TNormalizedUpdateInput): Promise<TEntity>;
  delete(id: number): Promise<TEntity>;
  softDelete(id: number): Promise<TEntity>;
  deleteMany?: (where?: WhereInput<TEntity>) => Promise<{ count: number }>;
  softDeleteMany?: (where?: WhereInput<TEntity>) => Promise<{ count: number }>;
  findByEmployeeName(employeeName: string): Promise<TEntity[]>;
  findByStatus(status: string): Promise<TEntity[]>;
  findByCategory(category: string): Promise<TEntity[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<TEntity[]>;
  getTotalByCategory(): Promise<Record<string, number>>;
  getTotalByStatus(): Promise<Record<string, number>>;
};

type ExpenseServiceBaseOptions<
  TEntity extends { id: number },
  TCreateInput,
  TUpdateInput extends { id?: number },
  TQuery,
  TNormalizedCreateInput,
  TNormalizedUpdateInput,
> = {
  repository: ExpenseRepositoryLike<
    TEntity,
    TQuery,
    TNormalizedCreateInput,
    TNormalizedUpdateInput
  >;
  entityType: string;
  normalizeCreateInput: (data: TCreateInput) => TNormalizedCreateInput;
  normalizeUpdateInput: (data: Partial<TUpdateInput>) => TNormalizedUpdateInput;
  resolveUpdateId?: (data: TUpdateInput) => number | null;
};

export class ExpenseServiceBase<
  TEntity extends { id: number },
  TCreateInput,
  TUpdateInput extends { id?: number },
  TQuery,
  TNormalizedCreateInput = unknown,
  TNormalizedUpdateInput = unknown,
> {
  protected readonly repository: ExpenseRepositoryLike<
    TEntity,
    TQuery,
    TNormalizedCreateInput,
    TNormalizedUpdateInput
  >;

  private readonly entityType: string;
  private readonly normalizeCreateInput: (
    data: TCreateInput
  ) => TNormalizedCreateInput;
  private readonly normalizeUpdateInput: (
    data: Partial<TUpdateInput>
  ) => TNormalizedUpdateInput;
  private readonly resolveUpdateId: (data: TUpdateInput) => number | null;

  constructor(
    options: ExpenseServiceBaseOptions<
      TEntity,
      TCreateInput,
      TUpdateInput,
      TQuery,
      TNormalizedCreateInput,
      TNormalizedUpdateInput
    >
  ) {
    this.repository = options.repository;
    this.entityType = options.entityType;
    this.normalizeCreateInput = options.normalizeCreateInput;
    this.normalizeUpdateInput = options.normalizeUpdateInput;
    this.resolveUpdateId =
      options.resolveUpdateId ??
      ((data: TUpdateInput) =>
        typeof data.id === 'number' ? data.id : Number(data.id));
  }

  async findAll(): Promise<TEntity[]> {
    try {
      return await this.repository.findMany({ orderBy: { date: 'desc' } });
    } catch (error) {
      logger.error('Failed to fetch expenses', { error });
      throw new Error('Failed to fetch expenses');
    }
  }

  async findWithFilters(filters: TQuery): Promise<TEntity[]> {
    try {
      return await this.repository.findWithFilters(filters);
    } catch (error) {
      logger.error('Failed to fetch filtered expenses', { error, filters });
      throw new Error('Failed to fetch filtered expenses');
    }
  }

  async findById(id: number): Promise<TEntity | null> {
    try {
      return await this.repository.findById(id);
    } catch (error) {
      logger.error('Failed to fetch expense', { error, id });
      throw new Error('Failed to fetch expense');
    }
  }

  async create(data: TCreateInput): Promise<TEntity> {
    try {
      const normalized = this.normalizeCreateInput(data);
      return await this.repository.create(normalized);
    } catch (error) {
      logger.error('Failed to create expense', { error, data });
      throw new Error('Failed to create expense');
    }
  }

  async createMany(data: TCreateInput[]): Promise<{ count: number }> {
    try {
      const normalized = data.map((item) => this.normalizeCreateInput(item));
      return await this.repository.createMany(normalized);
    } catch (error) {
      logger.error('Failed to create expenses', { error, count: data.length });
      throw new Error('Failed to create expenses');
    }
  }

  async update(id: number, data: Partial<TUpdateInput>): Promise<TEntity> {
    try {
      const existing = await this.repository.findById(id);
      if (!existing) {
        throw new Error(`Expense with ID ${id} not found`);
      }

      const normalized = this.normalizeUpdateInput(data);
      const updated = await this.repository.update(id, normalized);

      const { recordChange } = await import('@/core/change-log');
      await recordChange(
        {
          entityType: this.entityType,
          entityId: id,
          action: 'update',
          oldValue: existing,
          newValue: updated,
        },
        { source: 'api' }
      );

      return updated;
    } catch (error) {
      logger.error('Failed to update expense', { error, id, data });
      throw error;
    }
  }

  async updateMany(data: TUpdateInput[]): Promise<{ count: number }> {
    try {
      let updated = 0;

      for (const item of data) {
        const id = this.resolveUpdateId(item);
        if (typeof id === 'number' && Number.isFinite(id)) {
          await this.update(id, item);
          updated += 1;
        }
      }

      return { count: updated };
    } catch (error) {
      logger.error('Failed to update expenses', { error, count: data.length });
      throw new Error('Failed to update expenses');
    }
  }

  async delete(id: number): Promise<TEntity | void> {
    try {
      await this.repository.softDelete(id);
      logger.info('Expense deleted', { id });
    } catch (error) {
      logger.error('Failed to delete expense', { error, id });
      throw error;
    }
  }

  async deleteAll(): Promise<{ count: number }> {
    try {
      if (!this.repository.softDeleteMany) {
        throw new Error('Bulk soft delete is not available');
      }

      const result = await this.repository.softDeleteMany();

      logger.warn('All expenses deleted', { count: result.count });
      return result;
    } catch (error) {
      logger.error('Failed to delete all expenses', { error });
      throw new Error('Failed to delete all expenses');
    }
  }

  async findByEmployeeName(employeeName: string): Promise<TEntity[]> {
    try {
      return await this.repository.findByEmployeeName(employeeName);
    } catch (error) {
      logger.error('Failed to fetch expenses by employee', {
        error,
        employeeName,
      });
      throw new Error('Failed to fetch expenses by employee');
    }
  }

  async findByStatus(status: string): Promise<TEntity[]> {
    try {
      return await this.repository.findByStatus(status);
    } catch (error) {
      logger.error('Failed to fetch expenses by status', { error, status });
      throw new Error('Failed to fetch expenses by status');
    }
  }

  async findByCategory(category: string): Promise<TEntity[]> {
    try {
      return await this.repository.findByCategory(category);
    } catch (error) {
      logger.error('Failed to fetch expenses by category', { error, category });
      throw new Error('Failed to fetch expenses by category');
    }
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<TEntity[]> {
    try {
      return await this.repository.findByDateRange(startDate, endDate);
    } catch (error) {
      logger.error('Failed to fetch expenses by date range', {
        error,
        startDate,
        endDate,
      });
      throw new Error('Failed to fetch expenses by date range');
    }
  }

  async getStatsByCategory(): Promise<Record<string, number>> {
    try {
      return await this.repository.getTotalByCategory();
    } catch (error) {
      logger.error('Failed to fetch expense stats by category', { error });
      throw new Error('Failed to fetch expense stats by category');
    }
  }

  async getStatsByStatus(): Promise<Record<string, number>> {
    try {
      return await this.repository.getTotalByStatus();
    } catch (error) {
      logger.error('Failed to fetch expense stats by status', { error });
      throw new Error('Failed to fetch expense stats by status');
    }
  }

  async upsertBySource(
    payload: TCreateInput & { sourceId: string }
  ): Promise<TEntity> {
    if (!payload.sourceId) {
      throw new Error('sourceId is required for source-based upsert');
    }

    const normalized = this.normalizeCreateInput(payload);
    const repo = this.repository as ExpenseRepositoryLike<
      TEntity,
      TQuery,
      TNormalizedCreateInput,
      TNormalizedUpdateInput
    > &
      Partial<UpsertBySourceLike<TEntity>>;

    if (!repo.upsertBySource) {
      throw new Error('Source-based upsert is not supported for this domain');
    }

    return await repo.upsertBySource(normalized);
  }
}
