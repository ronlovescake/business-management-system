import type { NextRequest } from 'next/server';
import type { ZodError } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import { sanitizers, sanitizeRequestBody } from '@/lib/security/sanitize';
import {
  householdAccountService,
  HouseholdAccountQuerySchema,
  HouseholdAccountBatchCreateSchema,
  HouseholdAccountUpdateSchema,
  type HouseholdAccountQuery,
} from '@/modules/household/accounts/api';

const ensureArray = <T>(payload: T | T[]): T[] =>
  Array.isArray(payload) ? payload : [payload];

const buildValidationErrors = (error: ZodError) => {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const path = issue.path.join('.');
    acc[path] = issue.message;
    return acc;
  }, {});
};

/**
 * GET /api/household/accounts
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    const typeParam = searchParams.get('type');
    const isActiveParam = searchParams.get('isActive');
    const institutionParam = searchParams.get('institution');
    const searchParam = searchParams.get('search');

    const filters = HouseholdAccountQuerySchema.parse({
      type: typeParam ? sanitizers.name(typeParam) : undefined,
      isActive: isActiveParam ? sanitizers.name(isActiveParam) : undefined,
      institution: institutionParam
        ? sanitizers.name(institutionParam)
        : undefined,
      search: searchParam ? sanitizers.name(searchParam) : undefined,
    }) as HouseholdAccountQuery;

    const accounts = Object.values(filters).some(
      (v) => typeof v !== 'undefined'
    )
      ? await householdAccountService.findWithFilters(filters)
      : await householdAccountService.findAll();

    return ApiResponse.success(
      accounts,
      'Household accounts fetched successfully'
    );
  } catch (error) {
    logger.error('Failed to fetch household accounts', { error });
    return ApiResponse.error(
      'Failed to fetch household accounts',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * POST /api/household/accounts
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    const payload = await request.json();
    const items = ensureArray(payload);

    if (items.length === 0) {
      return ApiResponse.badRequest(
        'Request body must contain one or more accounts',
        {
          accounts: 'Provide at least one account record to create.',
        }
      );
    }

    const validation = HouseholdAccountBatchCreateSchema.safeParse(items);
    if (!validation.success) {
      logger.warn('Household account validation failed', {
        issues: validation.error.issues,
      });
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    if (validation.data.length === 1) {
      const created = await householdAccountService.create(validation.data[0]);
      return ApiResponse.success(
        created,
        'Household account created successfully',
        HTTP_STATUS.CREATED
      );
    }

    const result = await householdAccountService.createMany(validation.data);

    logger.info('Household accounts created', { count: result.count });

    return ApiResponse.success(
      { count: result.count },
      `Successfully created ${result.count} household accounts`,
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    logger.error('Failed to create household accounts', { error });
    return ApiResponse.error(
      'Failed to create household accounts',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * PATCH /api/household/accounts
 */
export const PATCH = withErrorHandler(async (request: NextRequest) => {
  try {
    const payload = await request.json();
    const sanitized =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? sanitizeRequestBody(payload as Record<string, unknown>)
        : {};

    const validation = HouseholdAccountUpdateSchema.safeParse(sanitized);
    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        buildValidationErrors(validation.error)
      );
    }

    const { id, ...updateData } = validation.data;
    const updated = await householdAccountService.update(id, updateData);

    return ApiResponse.success(
      updated,
      'Household account updated successfully'
    );
  } catch (error) {
    logger.error('Failed to update household account', { error });
    return ApiResponse.error(
      'Failed to update household account',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});

/**
 * DELETE /api/household/accounts?id=...
 */
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return ApiResponse.badRequest('Account id is required', {
        id: 'Provide an account id via ?id=...',
      });
    }

    await householdAccountService.delete(id);

    return ApiResponse.success(
      { id },
      'Household account deleted successfully'
    );
  } catch (error) {
    logger.error('Failed to delete household account', { error });
    return ApiResponse.error(
      'Failed to delete household account',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : String(error)
    );
  }
});
