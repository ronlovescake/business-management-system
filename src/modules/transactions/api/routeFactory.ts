import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api/response';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { MAX_QUERY_LIMIT } from '@/constants/batch-sizes';
import { logger } from '@/lib/logger';
import type { TransactionService } from './service';
import {
  TransactionNotFoundError,
  TransactionReferenceError,
  TransactionValidationError,
} from './service';

interface TransactionRouteConfig {
  service: TransactionService;
  loggerScope?: string;
}

const DEFAULT_SCOPE = 'Transactions';

export function createTransactionRoutes(config: TransactionRouteConfig) {
  const { service, loggerScope = DEFAULT_SCOPE } = config;

  const GET = withErrorHandler(async () => {
    try {
      const transactions = await service.findActive();
      logger.info(`[${loggerScope}] Transactions fetched`, {
        count: transactions.length,
      });
      return ApiResponse.success(transactions, 'Transactions fetched');
    } catch (error) {
      logger.error(`[${loggerScope}] Failed to fetch transactions`, { error });
      return ApiResponse.error('Failed to fetch transactions');
    }
  });

  const POST = withErrorHandler(async (request: NextRequest) => {
    try {
      const payload = await request.json();

      if (!Array.isArray(payload)) {
        return ApiResponse.badRequest('Invalid data format', {
          payload: 'Expected an array of transactions',
        });
      }

      if (payload.length === 0) {
        return ApiResponse.badRequest('Invalid data format', {
          payload: 'Empty transaction array',
        });
      }

      if (payload.length > MAX_QUERY_LIMIT) {
        return ApiResponse.payloadTooLarge(payload.length, MAX_QUERY_LIMIT);
      }

      const summary = await service.importTransactions(payload);
      return ApiResponse.success(
        summary,
        'Transactions imported',
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      if (error instanceof TransactionValidationError) {
        return ApiResponse.badRequest(error.message);
      }

      if (error instanceof TransactionReferenceError) {
        return ApiResponse.error(
          'Reference integrity violation',
          HTTP_STATUS.CONFLICT,
          JSON.stringify(error.details)
        );
      }

      logger.error(`[${loggerScope}] Failed to import transactions`, { error });
      return ApiResponse.error('Failed to import transactions');
    }
  });

  const PUT = withErrorHandler(async (request: NextRequest) => {
    try {
      const payload = await request.json();

      if (!Array.isArray(payload)) {
        return ApiResponse.badRequest('Invalid data format', {
          payload: 'Expected an array of transactions to update',
        });
      }

      if (payload.length === 0) {
        return ApiResponse.badRequest('Invalid data format', {
          payload: 'Empty update payload',
        });
      }

      if (payload.length > MAX_QUERY_LIMIT) {
        return ApiResponse.payloadTooLarge(payload.length, MAX_QUERY_LIMIT);
      }

      const summary = await service.bulkUpdateTransactions(payload);
      return ApiResponse.success(summary, 'Transactions updated');
    } catch (error) {
      if (error instanceof TransactionValidationError) {
        return ApiResponse.badRequest(error.message);
      }

      if (error instanceof TransactionNotFoundError) {
        return ApiResponse.notFound('Transaction');
      }

      logger.error(`[${loggerScope}] Failed to update transactions`, { error });
      return ApiResponse.error('Failed to update transactions');
    }
  });

  const PATCH = withErrorHandler(async (request: NextRequest) => {
    try {
      const payload = await request.json();
      const result = await service.updateTransaction(payload);
      return ApiResponse.success(result.transaction, 'Transaction updated');
    } catch (error) {
      if (error instanceof TransactionValidationError) {
        return ApiResponse.badRequest(error.message);
      }

      if (error instanceof TransactionNotFoundError) {
        return ApiResponse.notFound('Transaction');
      }

      logger.error(`[${loggerScope}] Failed to update transaction`, { error });
      return ApiResponse.error('Failed to update transaction');
    }
  });

  const DELETE = withErrorHandler(async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const confirmParam = searchParams.get('confirm');

      if (confirmParam !== 'DELETE_ALL_TRANSACTIONS') {
        return ApiResponse.badRequest('Mass deletion protection', {
          confirm:
            'Provide ?confirm=DELETE_ALL_TRANSACTIONS to acknowledge the operation',
        });
      }

      const result = await service.softDeleteAll();
      logger.warn(`[${loggerScope}] Transactions soft deleted`, {
        count: result.deleted,
      });

      return ApiResponse.success(
        {
          deleted: result.deleted,
          alreadyDeleted: result.alreadyDeleted,
          note: 'Records are soft-deleted and can be recovered if needed',
        },
        'Transactions soft deleted'
      );
    } catch (error) {
      logger.error(`[${loggerScope}] Failed to delete transactions`, { error });
      return ApiResponse.error('Failed to delete transactions');
    }
  });

  return { GET, POST, PUT, PATCH, DELETE };
}
