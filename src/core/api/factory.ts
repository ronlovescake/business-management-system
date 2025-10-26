/**
 * API Route Factory
 *
 * Factory functions to generate standard CRUD API routes with built-in:
 * - Validation using Zod schemas
 * - Consistent error handling
 * - Standardized responses
 * - Service layer integration
 * - Logging
 *
 * This eliminates boilerplate and ensures consistency across all API routes.
 *
 * @example
 * ```typescript
 * // In your API route file:
 * import { createCrudRoutes } from '@/core/api/factory';
 * import { leaveRequestService } from './service';
 * import { LeaveRequestCreateSchema, LeaveRequestUpdateSchema } from './schemas';
 *
 * export const { GET, POST, PUT, DELETE } = createCrudRoutes({
 *   service: leaveRequestService,
 *   schemas: {
 *     create: LeaveRequestCreateSchema,
 *     update: LeaveRequestUpdateSchema,
 *   },
 *   resourceName: 'Leave Request',
 * });
 * ```
 */

import type { NextRequest, NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import { ApiResponse } from '@/core/api/response';
import { logger } from '@/lib/logger';

/**
 * Base service interface that all services must implement
 */
export interface CrudService<T, TCreate, TUpdate> {
  findMany: (filter?: unknown) => Promise<T[]>;
  findById?: (id: string | number) => Promise<T | null>;
  create?: (data: TCreate) => Promise<T>;
  createMany?: (data: TCreate[]) => Promise<{ count: number }>;
  update?: (id: string | number, data: TUpdate) => Promise<T>;
  updateMany?: (
    ids: (string | number)[],
    data: TUpdate
  ) => Promise<{ count: number }>;
  delete?: (id: string | number) => Promise<void>;
  deleteMany?: (ids: (string | number)[]) => Promise<{ count: number }>;
}

/**
 * Configuration for creating CRUD routes
 */
export interface CrudRouteConfig<T, TCreate, TUpdate> {
  /** Service instance with CRUD methods */
  service: CrudService<T, TCreate, TUpdate>;
  /** Zod validation schemas */
  schemas: {
    create?: ZodSchema<TCreate>;
    update?: ZodSchema<TUpdate>;
    batchCreate?: ZodSchema;
    batchUpdate?: ZodSchema;
  };
  /** Resource name for error messages (e.g., "Leave Request") */
  resourceName: string;
  /** Custom GET handler (overrides default) */
  customGet?: (request: NextRequest) => Promise<NextResponse>;
  /** Custom POST handler (overrides default) */
  customPost?: (request: NextRequest) => Promise<NextResponse>;
  /** Custom PUT handler (overrides default) */
  customPut?: (request: NextRequest) => Promise<NextResponse>;
  /** Custom DELETE handler (overrides default) */
  customDelete?: (request: NextRequest) => Promise<NextResponse>;
  /** Transform response data before sending */
  transformResponse?: (data: T | T[]) => unknown;
}

/**
 * Creates standard CRUD route handlers
 *
 * Generates GET, POST, PUT, DELETE handlers with:
 * - Automatic validation
 * - Error handling
 * - Consistent responses
 * - Logging
 */
export function createCrudRoutes<T, TCreate, TUpdate>(
  config: CrudRouteConfig<T, TCreate, TUpdate>
) {
  const {
    service,
    schemas,
    resourceName,
    customGet,
    customPost,
    customPut,
    customDelete,
    transformResponse,
  } = config;

  /**
   * GET - List all resources
   * Query params: filter, sort, pagination (future)
   */
  const GET = async (request: NextRequest) => {
    if (customGet) {
      return customGet(request);
    }

    try {
      const { searchParams } = new URL(request.url);
      const filter = searchParams.get('filter');

      const data = await service.findMany(
        filter ? JSON.parse(filter) : undefined
      );
      const responseData = transformResponse ? transformResponse(data) : data;

      logger.info(`${resourceName} - GET all`, {
        count: Array.isArray(data) ? data.length : 0,
      });
      return ApiResponse.success(responseData);
    } catch (error) {
      logger.error(`${resourceName} - GET failed`, { error });
      return ApiResponse.error(
        `Failed to fetch ${resourceName.toLowerCase()}s`,
        500
      );
    }
  };

  /**
   * POST - Create new resource(s)
   * Supports both single and batch creation
   */
  const POST = async (request: NextRequest) => {
    if (customPost) {
      return customPost(request);
    }

    try {
      const body = await request.json();

      // Check if batch creation
      if (Array.isArray(body)) {
        if (!service.createMany) {
          return ApiResponse.error('Batch creation not supported', 405);
        }

        // Validate batch data
        if (schemas.batchCreate) {
          const validation = schemas.batchCreate.safeParse(body);
          if (!validation.success) {
            const errors = validation.error.errors.reduce(
              (acc, err) => ({ ...acc, [err.path.join('.')]: err.message }),
              {}
            );
            return ApiResponse.badRequest('Validation failed', errors);
          }
        }

        const result = await service.createMany(body);
        logger.info(`${resourceName} - POST batch`, { count: result.count });
        return ApiResponse.success(
          result,
          `Created ${result.count} ${resourceName.toLowerCase()}(s)`
        );
      }

      // Single creation
      if (!service.create) {
        return ApiResponse.error('Creation not supported', 405);
      }

      // Validate single data
      if (schemas.create) {
        const validation = schemas.create.safeParse(body);
        if (!validation.success) {
          const errors = validation.error.errors.reduce(
            (acc, err) => ({ ...acc, [err.path.join('.')]: err.message }),
            {}
          );
          return ApiResponse.badRequest('Validation failed', errors);
        }
      }

      const data = await service.create(body);
      const responseData = transformResponse ? transformResponse(data) : data;

      logger.info(`${resourceName} - POST single`, {
        id: (data as Record<string, unknown>).id,
      });
      return ApiResponse.success(
        responseData,
        `${resourceName} created successfully`
      );
    } catch (error) {
      logger.error(`${resourceName} - POST failed`, { error });
      return ApiResponse.error(
        `Failed to create ${resourceName.toLowerCase()}`,
        500
      );
    }
  };

  /**
   * PUT - Update resource(s)
   * Supports both single and batch updates
   */
  const PUT = async (request: NextRequest) => {
    if (customPut) {
      return customPut(request);
    }

    try {
      const body = await request.json();

      // Check if batch update
      if (Array.isArray(body)) {
        if (!service.updateMany) {
          return ApiResponse.error('Batch update not supported', 405);
        }

        // Validate batch data
        if (schemas.batchUpdate) {
          const validation = schemas.batchUpdate.safeParse(body);
          if (!validation.success) {
            const errors = validation.error.errors.reduce(
              (acc, err) => ({ ...acc, [err.path.join('.')]: err.message }),
              {}
            );
            return ApiResponse.badRequest('Validation failed', errors);
          }
        }

        const ids = body.map((item) => (item as { id: string | number }).id);
        const result = await service.updateMany(ids, body[0]);

        logger.info(`${resourceName} - PUT batch`, { count: result.count });
        return ApiResponse.success(
          result,
          `Updated ${result.count} ${resourceName.toLowerCase()}(s)`
        );
      }

      // Single update
      if (!service.update) {
        return ApiResponse.error('Update not supported', 405);
      }

      const { id, ...updateData } = body as { id: string | number };

      if (!id) {
        return ApiResponse.badRequest('ID is required for update');
      }

      // Validate update data
      if (schemas.update) {
        const validation = schemas.update.safeParse(updateData);
        if (!validation.success) {
          const errors = validation.error.errors.reduce(
            (acc, err) => ({ ...acc, [err.path.join('.')]: err.message }),
            {}
          );
          return ApiResponse.badRequest('Validation failed', errors);
        }
      }

      const data = await service.update(id, updateData as TUpdate);
      const responseData = transformResponse ? transformResponse(data) : data;

      logger.info(`${resourceName} - PUT single`, { id });
      return ApiResponse.success(
        responseData,
        `${resourceName} updated successfully`
      );
    } catch (error) {
      logger.error(`${resourceName} - PUT failed`, { error });
      return ApiResponse.error(
        `Failed to update ${resourceName.toLowerCase()}`,
        500
      );
    }
  };

  /**
   * DELETE - Delete resource(s)
   * Supports both single and batch deletion
   */
  const DELETE = async (request: NextRequest) => {
    if (customDelete) {
      return customDelete(request);
    }

    try {
      const body = await request.json();

      // Check if batch delete
      if (Array.isArray(body)) {
        if (!service.deleteMany) {
          return ApiResponse.error('Batch deletion not supported', 405);
        }

        const result = await service.deleteMany(body);
        logger.warn(`${resourceName} - DELETE batch`, { count: result.count });
        return ApiResponse.success(
          result,
          `Deleted ${result.count} ${resourceName.toLowerCase()}(s)`
        );
      }

      // Single delete
      if (!service.delete) {
        return ApiResponse.error('Deletion not supported', 405);
      }

      const { id } = body as { id: string | number };

      if (!id) {
        return ApiResponse.badRequest('ID is required for deletion');
      }

      await service.delete(id);
      logger.warn(`${resourceName} - DELETE single`, { id });
      return ApiResponse.success(
        { id },
        `${resourceName} deleted successfully`
      );
    } catch (error) {
      logger.error(`${resourceName} - DELETE failed`, { error });
      return ApiResponse.error(
        `Failed to delete ${resourceName.toLowerCase()}`,
        500
      );
    }
  };

  return { GET, POST, PUT, DELETE };
}

/**
 * Creates a single resource route handler (for /api/resource/[id])
 *
 * Generates GET, PUT, DELETE handlers for individual resources
 */
export function createSingleResourceRoutes<T, TUpdate>(config: {
  service: {
    findById: (id: string | number) => Promise<T | null>;
    update?: (id: string | number, data: TUpdate) => Promise<T>;
    delete?: (id: string | number) => Promise<void>;
  };
  schema?: ZodSchema<TUpdate>;
  resourceName: string;
  transformResponse?: (data: T) => unknown;
}) {
  const { service, schema, resourceName, transformResponse } = config;

  /**
   * GET - Get single resource by ID
   */
  const GET = async (
    request: NextRequest,
    { params }: { params: { id: string } }
  ) => {
    try {
      const { id } = params;

      if (!id) {
        return ApiResponse.badRequest('ID is required');
      }

      const data = await service.findById(id);

      if (!data) {
        return ApiResponse.notFound(resourceName);
      }

      const responseData = transformResponse ? transformResponse(data) : data;
      logger.debug(`${resourceName} - GET by ID`, { id });
      return ApiResponse.success(responseData);
    } catch (error) {
      logger.error(`${resourceName} - GET by ID failed`, { error });
      return ApiResponse.error(
        `Failed to fetch ${resourceName.toLowerCase()}`,
        500
      );
    }
  };

  /**
   * PUT - Update single resource
   */
  const PUT = async (
    request: NextRequest,
    { params }: { params: { id: string } }
  ) => {
    if (!service.update) {
      return ApiResponse.error('Update not supported', 405);
    }

    try {
      const { id } = params;
      const body = await request.json();

      if (!id) {
        return ApiResponse.badRequest('ID is required');
      }

      // Validate update data
      if (schema) {
        const validation = schema.safeParse(body);
        if (!validation.success) {
          const errors = validation.error.errors.reduce(
            (acc, err) => ({ ...acc, [err.path.join('.')]: err.message }),
            {}
          );
          return ApiResponse.badRequest('Validation failed', errors);
        }
      }

      const data = await service.update(id, body);
      const responseData = transformResponse ? transformResponse(data) : data;

      logger.info(`${resourceName} - PUT by ID`, { id });
      return ApiResponse.success(
        responseData,
        `${resourceName} updated successfully`
      );
    } catch (error) {
      logger.error(`${resourceName} - PUT by ID failed`, { error });
      return ApiResponse.error(
        `Failed to update ${resourceName.toLowerCase()}`,
        500
      );
    }
  };

  /**
   * DELETE - Delete single resource
   */
  const DELETE = async (
    request: NextRequest,
    { params }: { params: { id: string } }
  ) => {
    if (!service.delete) {
      return ApiResponse.error('Deletion not supported', 405);
    }

    try {
      const { id } = params;

      if (!id) {
        return ApiResponse.badRequest('ID is required');
      }

      await service.delete(id);
      logger.warn(`${resourceName} - DELETE by ID`, { id });
      return ApiResponse.success(
        { id },
        `${resourceName} deleted successfully`
      );
    } catch (error) {
      logger.error(`${resourceName} - DELETE by ID failed`, { error });
      return ApiResponse.error(
        `Failed to delete ${resourceName.toLowerCase()}`,
        500
      );
    }
  };

  return { GET, PUT, DELETE };
}
