/**
 * Base Repository Pattern
 *
 * Generic CRUD operations with soft delete, audit logging, and pagination
 *
 * @example
 * const expenseRepo = new BaseRepository(prisma.expense, 'Expense');
 * const expenses = await expenseRepo.findMany({ where: { status: 'approved' } });
 */

import { logger } from '@/lib/logger';

export interface BaseEntity {
  id: string | number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export interface FindManyOptions<T> {
  where?: Partial<T>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  skip?: number;
  take?: number;
  include?: Record<string, boolean | object>;
  select?: Record<string, boolean>;
}

export interface CreateOptions {
  skipAuditLog?: boolean;
}

export interface UpdateOptions {
  skipAuditLog?: boolean;
}

export interface DeleteOptions {
  soft?: boolean; // Default: true
  skipAuditLog?: boolean;
}

type RepositoryModelDelegate<T extends BaseEntity> = {
  findMany: (args: unknown) => Promise<T[]>;
  count: (args: unknown) => Promise<number>;
  findFirst: (args: unknown) => Promise<T | null>;
  create: (args: unknown) => Promise<T>;
  createMany: (args: unknown) => Promise<{ count: number }>;
  update: (args: unknown) => Promise<T>;
  upsert: (args: unknown) => Promise<T>;
  delete: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
  deleteMany: (args: unknown) => Promise<{ count: number }>;
};

const toRepositoryModelDelegate = <T extends BaseEntity>(
  model: unknown,
  modelName: string
): RepositoryModelDelegate<T> => {
  const delegate = model as Partial<RepositoryModelDelegate<T>>;

  if (
    !delegate ||
    typeof delegate.findMany !== 'function' ||
    typeof delegate.count !== 'function' ||
    typeof delegate.findFirst !== 'function' ||
    typeof delegate.create !== 'function' ||
    typeof delegate.createMany !== 'function' ||
    typeof delegate.update !== 'function' ||
    typeof delegate.upsert !== 'function' ||
    typeof delegate.delete !== 'function' ||
    typeof delegate.updateMany !== 'function' ||
    typeof delegate.deleteMany !== 'function'
  ) {
    throw new Error(`Invalid model delegate for ${modelName}`);
  }

  return delegate as RepositoryModelDelegate<T>;
};

/**
 * Base Repository
 *
 * Provides generic CRUD operations for any Prisma model
 */
export class BaseRepository<T extends BaseEntity> {
  private model: RepositoryModelDelegate<T>;

  constructor(
    model: unknown, // Prisma model delegate
    private modelName: string
  ) {
    this.model = toRepositoryModelDelegate<T>(model, modelName);
  }

  /**
   * Find all records
   */
  async findAll(options: FindManyOptions<T> = {}): Promise<T[]> {
    try {
      const where = this.addSoftDeleteFilter(options.where);

      return await this.model.findMany({
        ...options,
        where,
      });
    } catch (error) {
      logger.error(`${this.modelName}: findAll failed`, { error, options });
      throw error;
    }
  }

  /**
   * Find many records with pagination
   */
  async findMany(
    options: FindManyOptions<T> = {}
  ): Promise<{ data: T[]; total: number }> {
    try {
      const where = this.addSoftDeleteFilter(options.where);

      const [data, total] = await Promise.all([
        this.model.findMany({
          ...options,
          where,
        }),
        this.model.count({ where }),
      ]);

      return { data, total };
    } catch (error) {
      logger.error(`${this.modelName}: findMany failed`, { error, options });
      throw error;
    }
  }

  /**
   * Find one record by ID
   */
  async findById(
    id: string | number,
    include?: Record<string, boolean | object>
  ): Promise<T | null> {
    try {
      return await this.model.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        ...(include && { include }),
      });
    } catch (error) {
      logger.error(`${this.modelName}: findById failed`, { error, id });
      throw error;
    }
  }

  /**
   * Find one record by custom filter
   */
  async findOne(
    where: Partial<T>,
    include?: Record<string, boolean | object>
  ): Promise<T | null> {
    try {
      const whereWithSoftDelete = this.addSoftDeleteFilter(where);

      return await this.model.findFirst({
        where: whereWithSoftDelete,
        ...(include && { include }),
      });
    } catch (error) {
      logger.error(`${this.modelName}: findOne failed`, { error, where });
      throw error;
    }
  }

  /**
   * Create a new record
   */
  async create(
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
    options: CreateOptions = {}
  ): Promise<T> {
    try {
      const record = await this.model.create({
        data,
      });

      if (!options.skipAuditLog) {
        logger.info(`${this.modelName}: Created`, { id: record.id });
      }

      return record;
    } catch (error) {
      logger.error(`${this.modelName}: create failed`, { error, data });
      throw error;
    }
  }

  /**
   * Create many records
   */
  async createMany(
    data: Array<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>,
    options: CreateOptions = {}
  ): Promise<{ count: number }> {
    try {
      const result = await this.model.createMany({
        data,
        skipDuplicates: true,
      });

      if (!options.skipAuditLog) {
        logger.info(`${this.modelName}: Created ${result.count} records`);
      }

      return result;
    } catch (error) {
      logger.error(`${this.modelName}: createMany failed`, {
        error,
        count: data.length,
      });
      throw error;
    }
  }

  /**
   * Update a record
   */
  async update(
    id: string | number,
    data: Partial<Omit<T, 'id' | 'createdAt'>>,
    options: UpdateOptions = {}
  ): Promise<T> {
    try {
      const record = await this.model.update({
        where: { id },
        data,
      });

      if (!options.skipAuditLog) {
        logger.info(`${this.modelName}: Updated`, { id });
      }

      return record;
    } catch (error) {
      logger.error(`${this.modelName}: update failed`, { error, id, data });
      throw error;
    }
  }

  /**
   * Upsert (create or update)
   */
  async upsert(
    where: Partial<T>,
    create: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
    update: Partial<Omit<T, 'id' | 'createdAt'>>,
    options: CreateOptions & UpdateOptions = {}
  ): Promise<T> {
    try {
      const record = await this.model.upsert({
        where,
        create,
        update,
      });

      if (!options.skipAuditLog) {
        logger.info(`${this.modelName}: Upserted`, { id: record.id });
      }

      return record;
    } catch (error) {
      logger.error(`${this.modelName}: upsert failed`, { error, where });
      throw error;
    }
  }

  /**
   * Delete a record (soft delete by default)
   */
  async delete(
    id: string | number,
    options: DeleteOptions = { soft: true }
  ): Promise<T | void> {
    try {
      if (options.soft !== false) {
        // Soft delete
        const record = await this.model.update({
          where: { id },
          data: { deletedAt: new Date() },
        });

        if (!options.skipAuditLog) {
          logger.info(`${this.modelName}: Soft deleted`, { id });
        }

        return record;
      } else {
        // Hard delete
        await this.model.delete({
          where: { id },
        });

        if (!options.skipAuditLog) {
          logger.info(`${this.modelName}: Hard deleted`, { id });
        }
      }
    } catch (error) {
      logger.error(`${this.modelName}: delete failed`, { error, id });
      throw error;
    }
  }

  /**
   * Delete many records
   */
  async deleteMany(
    where: Partial<T>,
    options: DeleteOptions = { soft: true }
  ): Promise<{ count: number }> {
    try {
      if (options.soft !== false) {
        // Soft delete
        const result = await this.model.updateMany({
          where,
          data: { deletedAt: new Date() },
        });

        if (!options.skipAuditLog) {
          logger.info(
            `${this.modelName}: Soft deleted ${result.count} records`
          );
        }

        return result;
      } else {
        // Hard delete
        const result = await this.model.deleteMany({
          where,
        });

        if (!options.skipAuditLog) {
          logger.info(
            `${this.modelName}: Hard deleted ${result.count} records`
          );
        }

        return result;
      }
    } catch (error) {
      logger.error(`${this.modelName}: deleteMany failed`, { error, where });
      throw error;
    }
  }

  /**
   * Restore soft deleted record
   */
  async restore(id: string | number): Promise<T> {
    try {
      const record = await this.model.update({
        where: { id },
        data: { deletedAt: null },
      });

      logger.info(`${this.modelName}: Restored`, { id });
      return record;
    } catch (error) {
      logger.error(`${this.modelName}: restore failed`, { error, id });
      throw error;
    }
  }

  /**
   * Count records
   */
  async count(where?: Partial<T>): Promise<number> {
    try {
      const whereWithSoftDelete = this.addSoftDeleteFilter(where);
      return await this.model.count({ where: whereWithSoftDelete });
    } catch (error) {
      logger.error(`${this.modelName}: count failed`, { error, where });
      throw error;
    }
  }

  /**
   * Check if record exists
   */
  async exists(where: Partial<T>): Promise<boolean> {
    try {
      const whereWithSoftDelete = this.addSoftDeleteFilter(where);
      const count = await this.model.count({ where: whereWithSoftDelete });
      return count > 0;
    } catch (error) {
      logger.error(`${this.modelName}: exists failed`, { error, where });
      throw error;
    }
  }

  /**
   * Add soft delete filter to where clause
   */
  private addSoftDeleteFilter(where?: Partial<T>): Partial<T> {
    return {
      ...(where ?? {}),
      deletedAt: null,
    } as Partial<T>;
  }
}
