import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import { householdExpenseService } from '@/modules/household/expenses/api';

const parseId = (raw: string): number | null => {
  const id = Number(raw);
  if (!Number.isFinite(id)) {
    return null;
  }
  return id;
};

/**
 * GET /api/household/expenses/:id
 */
export const GET = withErrorHandler(
  async (_request: NextRequest, context?: { params: { id: string } }) => {
    try {
      const rawId = context?.params?.id;
      if (!rawId) {
        return ApiResponse.badRequest('Expense ID is required', {
          id: 'Provide the expense ID in the route path.',
        });
      }

      const id = parseId(rawId);
      if (id === null) {
        return ApiResponse.badRequest('Invalid expense ID', {
          id: 'Expense ID must be a number.',
        });
      }

      const expense = await householdExpenseService.findById(id);
      if (!expense) {
        return ApiResponse.notFound('Household expense');
      }

      return ApiResponse.success(expense, 'Household expense fetched');
    } catch (error) {
      logger.error('Failed to fetch household expense', {
        error,
        id: context?.params?.id,
      });
      return ApiResponse.error(
        'Failed to fetch household expense',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

/**
 * DELETE /api/household/expenses/:id
 */
export const DELETE = withErrorHandler(
  async (_request: NextRequest, context?: { params: { id: string } }) => {
    try {
      const rawId = context?.params?.id;
      if (!rawId) {
        return ApiResponse.badRequest('Expense ID is required', {
          id: 'Provide the expense ID in the route path.',
        });
      }

      const id = parseId(rawId);
      if (id === null) {
        return ApiResponse.badRequest('Invalid expense ID', {
          id: 'Expense ID must be a number.',
        });
      }

      await householdExpenseService.delete(id);

      return ApiResponse.success({ id }, 'Household expense deleted');
    } catch (error) {
      logger.error('Failed to delete household expense', {
        error,
        id: context?.params?.id,
      });
      return ApiResponse.error(
        'Failed to delete household expense',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);
