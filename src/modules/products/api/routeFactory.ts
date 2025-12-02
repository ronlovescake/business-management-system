import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api/response';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { MAX_QUERY_LIMIT } from '@/constants/batch-sizes';
import { logger } from '@/lib/logger';
import { getDatabaseUrl } from '@/lib/env';
import type { ProductDTO } from './dto';
import type { ProductService } from './service';
import { sanitizeProductRecord } from './sanitizers';
import { productDataSchema } from './schemas';

interface ProductRouteConfig {
  service: ProductService;
  loggerScope?: string;
}

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

function formatValidationErrors(error: unknown): Record<string, string> {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (
      error as { issues: Array<{ path: (string | number)[]; message: string }> }
    ).issues;
    return issues.reduce<Record<string, string>>((acc, issue) => {
      const key = issue.path.join('.') || 'root';
      acc[key] = issue.message;
      return acc;
    }, {});
  }
  return { general: 'Invalid payload' };
}

function validateRecords(payload: unknown[]): {
  valid: ProductDTO[];
  invalid: Array<{ index: number; issues: Record<string, string> }>;
} {
  const valid: ProductDTO[] = [];
  const invalid: Array<{ index: number; issues: Record<string, string> }> = [];

  payload.forEach((entry, index) => {
    const sanitized = sanitizeProductRecord(entry);
    const result = productDataSchema.safeParse(sanitized);
    if (result.success) {
      valid.push({ ...sanitized, ...result.data });
    } else {
      invalid.push({ index, issues: formatValidationErrors(result.error) });
    }
  });

  return { valid, invalid };
}

export function createProductRoutes(config: ProductRouteConfig) {
  const { service, loggerScope = 'Products' } = config;

  const GET = withErrorHandler(async () => {
    try {
      const products = await service.findActive();
      logger.info(`[${loggerScope}] Products fetched`, {
        count: products.length,
      });
      return ApiResponse.success(products, 'Products fetched');
    } catch (error) {
      logger.error(`[${loggerScope}] Failed to fetch products`, { error });
      return ApiResponse.error('Failed to fetch products');
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
      const payload = await request.json();

      if (!Array.isArray(payload)) {
        return ApiResponse.badRequest('Invalid data format', {
          payload: 'Expected an array of products',
        });
      }

      if (payload.length === 0) {
        return ApiResponse.badRequest('Invalid data format', {
          payload: 'Empty product array',
        });
      }

      if (payload.length > MAX_QUERY_LIMIT) {
        return ApiResponse.payloadTooLarge(payload.length, MAX_QUERY_LIMIT);
      }

      const { valid, invalid } = validateRecords(payload);

      if (valid.length === 0) {
        return ApiResponse.badRequest('Validation failed', {
          products:
            'All rows failed validation. Please review the import file.',
        });
      }

      if (valid.length === 1) {
        const created = await service.createSingle(valid[0]);
        logger.info(`[${loggerScope}] Created single product`, {
          productCode: created['Product Code'],
        });
        return ApiResponse.success(
          {
            product: created,
            skipped: invalid.length,
            skippedDetails: invalid,
          },
          'Product added',
          HTTP_STATUS.CREATED
        );
      }

      const summary = await service.bulkImport(valid);
      logger.info(`[${loggerScope}] Imported products`, summary);
      return ApiResponse.success(
        {
          ...summary,
          skipped: invalid.length,
          skippedDetails: invalid,
          total: summary.created + summary.updated + summary.restored,
        },
        'Products imported'
      );
    } catch (error) {
      logger.error(`[${loggerScope}] Failed to import products`, { error });
      return ApiResponse.error('Failed to process products');
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
          payload: 'Expected an array of products',
        });
      }

      if (payload.length > MAX_QUERY_LIMIT) {
        return ApiResponse.payloadTooLarge(payload.length, MAX_QUERY_LIMIT);
      }

      const { valid, invalid } = validateRecords(payload);

      if (valid.length === 0) {
        return ApiResponse.badRequest('Validation failed', {
          products:
            'All rows failed validation. Please review the paste payload.',
        });
      }

      const summary = await service.bulkUpdate(valid);
      logger.info(`[${loggerScope}] Updated products`, summary);

      return ApiResponse.success(
        {
          ...summary,
          skipped: invalid.length,
          skippedDetails: invalid,
          total: summary.created + summary.updated + summary.restored,
        },
        'Products updated'
      );
    } catch (error) {
      logger.error(`[${loggerScope}] Failed to update products`, { error });
      return ApiResponse.error('Failed to update products');
    }
  });

  const DELETE = withErrorHandler(async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const confirmParam = searchParams.get('confirm');

      if (confirmParam !== 'DELETE_ALL_PRODUCTS') {
        return ApiResponse.badRequest('Mass deletion protection', {
          confirm:
            'Provide ?confirm=DELETE_ALL_PRODUCTS to acknowledge the operation',
        });
      }

      const { deleted } = await service.softDeleteAll();
      logger.warn(`[${loggerScope}] Products soft deleted`, { count: deleted });
      return ApiResponse.success(
        {
          deleted,
          note: 'Records are soft-deleted and can be recovered if needed',
        },
        'Products soft deleted'
      );
    } catch (error) {
      logger.error(`[${loggerScope}] Failed to delete products`, { error });
      return ApiResponse.error('Failed to delete products');
    }
  });

  return { GET, POST, PUT, DELETE };
}
