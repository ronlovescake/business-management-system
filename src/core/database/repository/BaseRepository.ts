/**
 * Base Repository
 *
 * Generic repository class that provides common CRUD operations
 * for all database entities using Prisma.
 *
 * Benefits:
 * - DRY (Don't Repeat Yourself) - Common operations in one place
 * - Consistent error handling across all repositories
 * - Type-safe database operations
 * - Centralized logging
 * - Easy to extend with custom methods
 *
 * @example
 * ```typescript
 * class UserRepository extends BaseRepository<User, UserCreateInput, UserUpdateInput> {
 *   constructor() {
 *     super('user');
 *   }
 *
 *   // Add custom methods
 *   async findByEmail(email: string) {
 *     return this.findFirst({ where: { email } });
 *   }
 * }
 * ```
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { PrismaModelName } from '@/types/prisma';

/**
 * Generic where clause type
 */
export type WhereInput<T> = Partial<T> & {
  AND?: WhereInput<T>[];
  OR?: WhereInput<T>[];
  NOT?: WhereInput<T>[];
};

/**
 * Order by type
 */
export type OrderByInput<T> = {
  [K in keyof T]?: 'asc' | 'desc';
};

/**
 * Find options
 */
export interface FindOptions<T> {
  where?: WhereInput<T>;
  orderBy?: OrderByInput<T> | OrderByInput<T>[];
  skip?: number;
  take?: number;
  include?: Record<string, boolean | object>;
  select?: Record<string, boolean>;
}

/**
 * Base Repository class
 *
 * @template TEntity - The entity type (e.g., User, Product)
 * @template TCreateInput - The input type for creating entities
 * @template TUpdateInput - The input type for updating entities
 */
export abstract class BaseRepository<TEntity, TCreateInput, TUpdateInput> {
  /**
   * The Prisma model name (e.g., 'user', 'product', 'leaveRequest')
   * Must be set by child classes. Type restricted to known Prisma models.
   */
  protected abstract readonly modelName: PrismaModelName;

  /**
   * Get the Prisma delegate for this model
   *
   * Note: TypeScript cannot type-check dynamic model access at compile time.
   * We use `any` here because Prisma's client structure requires runtime model resolution.
   * Type safety is enforced through:
   * - PrismaModelName restricts modelName to valid Prisma models
   * - Generic TEntity parameter enforces result type correctness
   * - Each repository validates its modelName matches its entity type
   * 
   * This is an acceptable use of `any` for dynamic model access patterns.
   * See: https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prisma-client-api
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get model(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (prisma as any)[this.modelName];
  }

  /**
   * Find multiple records
   *
   * @param options - Query options (where, orderBy, pagination, etc.)
   * @returns Array of entities
   *
   * @example
   * ```typescript
   * const users = await userRepository.findMany({
   *   where: { isActive: true },
   *   orderBy: { createdAt: 'desc' },
   *   take: 10
   * });
   * ```
   */
  async findMany(options?: FindOptions<TEntity>): Promise<TEntity[]> {
    try {
      const result = await this.model.findMany(options);
      logger.debug(`${this.modelName}.findMany`, {
        count: result.length,
        options,
      });
      return result;
    } catch (error) {
      logger.error(`${this.modelName}.findMany failed`, { error, options });
      throw error;
    }
  }

  /**
   * Find a single record by ID
   *
   * @param id - The record ID
   * @returns The entity or null if not found
   */
  async findById(id: number | string): Promise<TEntity | null> {
    try {
      const result = await this.model.findUnique({
        where: { id },
      });
      logger.debug(`${this.modelName}.findById`, { id, found: !!result });
      return result;
    } catch (error) {
      logger.error(`${this.modelName}.findById failed`, { error, id });
      throw error;
    }
  }

  /**
   * Find first record matching criteria
   *
   * @param options - Query options
   * @returns The entity or null if not found
   */
  async findFirst(options: FindOptions<TEntity>): Promise<TEntity | null> {
    try {
      const result = await this.model.findFirst(options);
      logger.debug(`${this.modelName}.findFirst`, { found: !!result, options });
      return result;
    } catch (error) {
      logger.error(`${this.modelName}.findFirst failed`, { error, options });
      throw error;
    }
  }

  /**
   * Count records matching criteria
   *
   * @param where - Where clause
   * @returns Count of matching records
   */
  async count(where?: WhereInput<TEntity>): Promise<number> {
    try {
      const count = await this.model.count({ where });
      logger.debug(`${this.modelName}.count`, { count, where });
      return count;
    } catch (error) {
      logger.error(`${this.modelName}.count failed`, { error, where });
      throw error;
    }
  }

  /**
   * Create a single record
   *
   * @param data - Data to create
   * @returns The created entity
   */
  async create(data: TCreateInput): Promise<TEntity> {
    try {
      const result = await this.model.create({ data });
      const id = (result as Record<string, unknown>).id;
      logger.info(`${this.modelName}.create`, { id });
      return result;
    } catch (error) {
      logger.error(`${this.modelName}.create failed`, { error });
      throw error;
    }
  }

  /**
   * Create multiple records (batch operation)
   *
   * @param data - Array of data to create
   * @returns Object with count of created records
   */
  async createMany(data: TCreateInput[]): Promise<{ count: number }> {
    try {
      const result = await this.model.createMany({ data });
      logger.info(`${this.modelName}.createMany`, { count: result.count });
      return result;
    } catch (error) {
      logger.error(`${this.modelName}.createMany failed`, { error });
      throw error;
    }
  }

  /**
   * Update a single record
   *
   * @param id - Record ID
   * @param data - Data to update
   * @returns The updated entity
   */
  async update(id: number | string, data: TUpdateInput): Promise<TEntity> {
    try {
      const result = await this.model.update({
        where: { id },
        data,
      });
      logger.info(`${this.modelName}.update`, { id });
      return result;
    } catch (error) {
      logger.error(`${this.modelName}.update failed`, { error, id });
      throw error;
    }
  }

  /**
   * Update multiple records matching criteria
   *
   * @param where - Where clause
   * @param data - Data to update
   * @returns Object with count of updated records
   */
  async updateMany(
    where: WhereInput<TEntity>,
    data: TUpdateInput
  ): Promise<{ count: number }> {
    try {
      const result = await this.model.updateMany({ where, data });
      logger.info(`${this.modelName}.updateMany`, { count: result.count });
      return result;
    } catch (error) {
      logger.error(`${this.modelName}.updateMany failed`, { error, where });
      throw error;
    }
  }

  /**
   * Delete a single record (soft delete if configured)
   *
   * @param id - Record ID
   * @returns The deleted entity
   */
  async delete(id: number | string): Promise<TEntity> {
    try {
      const result = await this.model.delete({
        where: { id },
      });
      logger.warn(`${this.modelName}.delete`, { id });
      return result;
    } catch (error) {
      logger.error(`${this.modelName}.delete failed`, { error, id });
      throw error;
    }
  }

  /**
   * Delete multiple records (soft delete if configured)
   *
   * @param where - Where clause (optional, if omitted deletes all)
   * @returns Object with count of deleted records
   */
  async deleteMany(where?: WhereInput<TEntity>): Promise<{ count: number }> {
    try {
      const result = await this.model.deleteMany({ where });
      logger.warn(`${this.modelName}.deleteMany`, {
        count: result.count,
        where,
      });
      return result;
    } catch (error) {
      logger.error(`${this.modelName}.deleteMany failed`, { error, where });
      throw error;
    }
  }

  /**
   * Upsert a record (update if exists, create if not)
   *
   * @param where - Unique identifier
   * @param create - Data to create if not exists
   * @param update - Data to update if exists
   * @returns The upserted entity
   */
  async upsert(
    where: { id: number | string },
    create: TCreateInput,
    update: TUpdateInput
  ): Promise<TEntity> {
    try {
      const result = await this.model.upsert({
        where,
        create,
        update,
      });
      logger.info(`${this.modelName}.upsert`, { id: where.id });
      return result;
    } catch (error) {
      logger.error(`${this.modelName}.upsert failed`, { error, where });
      throw error;
    }
  }

  /**
   * Check if a record exists
   *
   * @param where - Where clause
   * @returns True if exists, false otherwise
   */
  async exists(where: WhereInput<TEntity>): Promise<boolean> {
    try {
      const count = await this.model.count({ where, take: 1 });
      return count > 0;
    } catch (error) {
      logger.error(`${this.modelName}.exists failed`, { error, where });
      throw error;
    }
  }

  /**
   * Execute a transaction with multiple operations
   *
   * Note: For transactions, use prisma.$transaction directly in your service layer
   * This method is provided for convenience but has type limitations
   *
   * @example
   * ```typescript
   * // In your service:
   * await prisma.$transaction(async (tx) => {
   *   await tx.user.create({ data: userData });
   *   await tx.profile.create({ data: profileData });
   * });
   * ```
   */
  protected get prismaClient() {
    return prisma;
  }
}
