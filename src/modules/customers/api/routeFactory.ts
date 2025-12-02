import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { ApiResponse } from '@/core/api/response';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import { MAX_QUERY_LIMIT } from '@/constants/batch-sizes';
import {
  customerDataSchema,
  formatValidationErrors,
} from '@/lib/validations/customer.validation';
import { getDatabaseUrl } from '@/lib/env';
import type { CustomerService } from './service';
import type { CustomerDTO } from './dto';
import { sanitizeCustomerRecord } from './sanitizers';

interface CustomerRouteConfig {
  service: CustomerService;
  loggerScope?: string;
}

const DEFAULT_SCOPE = 'Customers';

function dbNotConfigured(): string | null {
  try {
    const url = getDatabaseUrl();
    if (/postgresql:\/\/username:password@/i.test(url)) {
      return 'DATABASE_URL still has placeholder username/password';
    }
    return null;
  } catch {
    return 'DATABASE_URL is not set';
  }
}

function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.toLowerCase().includes('authentication failed');
}

export function createCustomerRoutes(config: CustomerRouteConfig) {
  const { service, loggerScope = DEFAULT_SCOPE } = config;

  const GET = withErrorHandler(async () => {
    try {
      const customers = await service.findActive();
      logger.info(`[${loggerScope}] Customers fetched`, {
        count: customers.length,
      });
      return ApiResponse.success(customers, 'Customers fetched');
    } catch (error) {
      logger.error(`[${loggerScope}] Failed to fetch customers`, { error });
      return ApiResponse.error('Failed to fetch customers');
    }
  });

  const PUT = withErrorHandler(async (request: NextRequest) => {
    const misconfig = dbNotConfigured();
    if (misconfig) {
      return ApiResponse.error(
        `Database not configured: ${misconfig}`,
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    try {
      const payload = await request.json();

      if (!Array.isArray(payload)) {
        return ApiResponse.badRequest('Invalid data format', {
          payload: 'Expected an array of customers',
        });
      }

      if (payload.length > MAX_QUERY_LIMIT) {
        return ApiResponse.payloadTooLarge(payload.length, MAX_QUERY_LIMIT);
      }

      const normalizedPayload = payload.map((entry) =>
        sanitizeCustomerRecord(entry)
      );

      const validCustomers: CustomerDTO[] = [];
      const invalidCustomers: Array<{
        index: number;
        issues: Record<string, string>;
      }> = [];

      normalizedPayload.forEach((record, index) => {
        const result = customerDataSchema.safeParse(record);
        if (result.success) {
          validCustomers.push(result.data as CustomerDTO);
        } else {
          const issues = formatValidationErrors(result.error);
          invalidCustomers.push({ index, issues });
          logger.warn(`Customer #${index + 1} skipped - validation failed`, {
            customerName: record['Customer Name'] || '(no name)',
            row: index + 1,
            issues,
          });
        }
      });

      logger.info(`[${loggerScope}] Customer import summary`, {
        total: normalizedPayload.length,
        valid: validCustomers.length,
        skipped: invalidCustomers.length,
      });

      if (validCustomers.length === 0) {
        return ApiResponse.badRequest('Validation failed', {
          customers: 'All rows failed validation. Please review the CSV.',
        });
      }

      const { created, updated } = await service.bulkSync(validCustomers);

      const skippedDetails = invalidCustomers.map(({ index, issues }) => ({
        row: index + 1,
        customerName: normalizedPayload[index]['Customer Name'] || '(no name)',
        issues,
      }));

      return ApiResponse.success(
        {
          created,
          updated,
          skipped: invalidCustomers.length,
          skippedDetails,
        },
        'Customers synced'
      );
    } catch (error) {
      logger.error(`[${loggerScope}] Failed to upsert customers`, { error });

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return ApiResponse.notFound('Customer');
        }
        if (error.code === 'P2002') {
          return ApiResponse.conflict(
            'Duplicate customer',
            'A customer with this information already exists'
          );
        }
      }

      if (isAuthError(error)) {
        return ApiResponse.error(
          'Database authentication failed. Check DATABASE_URL credentials.',
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      return ApiResponse.error('Failed to save customers');
    }
  });

  const POST = withErrorHandler(async (request: NextRequest) => {
    const misconfig = dbNotConfigured();
    if (misconfig) {
      return ApiResponse.error(
        `Database not configured: ${misconfig}`,
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    try {
      const body = await request.json();
      const sanitized = sanitizeCustomerRecord(body);
      const validation = customerDataSchema.safeParse(sanitized);

      if (!validation.success) {
        logger.warn(`[${loggerScope}] Customer validation failed`, {
          issues: validation.error.errors,
        });
        return ApiResponse.badRequest(
          'Validation failed',
          formatValidationErrors(validation.error)
        );
      }

      const created = await service.create(validation.data as CustomerDTO);
      return ApiResponse.success(
        created,
        'Customer created',
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      logger.error(`[${loggerScope}] Failed to create customer`, { error });

      if (isAuthError(error)) {
        return ApiResponse.error(
          'Database authentication failed. Check DATABASE_URL credentials.',
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      return ApiResponse.error('Failed to create customer');
    }
  });

  const DELETE = withErrorHandler(async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const confirmParam = searchParams.get('confirm');

      if (confirmParam !== 'DELETE_ALL_CUSTOMERS') {
        return ApiResponse.badRequest('Mass deletion protection', {
          confirm:
            'Provide ?confirm=DELETE_ALL_CUSTOMERS to acknowledge the operation',
        });
      }

      const { deleted } = await service.softDeleteAll();

      logger.warn(`[${loggerScope}] Customers soft deleted`, {
        count: deleted,
      });

      return ApiResponse.success(
        {
          deleted,
          note: 'Records are soft-deleted and can be recovered if needed',
        },
        'Customers soft deleted'
      );
    } catch (error) {
      logger.error(`[${loggerScope}] Failed to delete customers`, { error });
      return ApiResponse.error('Failed to delete customers');
    }
  });

  return { GET, PUT, POST, DELETE };
}
