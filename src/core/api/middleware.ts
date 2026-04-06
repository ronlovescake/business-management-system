/**
 * API Middleware
 *
 * Reusable middleware for authentication, validation, error handling, etc.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import { ApiResponseUtil } from './response';
import { logger } from '@/lib/logger';

interface ErrorHandlerOptions {
  onError?: (error: unknown, request: NextRequest) => NextResponse | undefined;
}

/**
 * Error Handler Middleware
 *
 * Wraps route handlers with error handling
 *
 * @example
 * export const GET = withErrorHandler(async (request) => {
 *   const data = await fetchData();
 *   return ApiResponse.success(data);
 * });
 */
export function withErrorHandler<T = unknown>(
  handler: (request: NextRequest, context?: T) => Promise<NextResponse>,
  options: ErrorHandlerOptions = {}
) {
  return async (request: NextRequest, context?: T): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      const path = (() => {
        if (request?.nextUrl?.pathname) {
          return request.nextUrl.pathname;
        }
        try {
          return new URL(request.url).pathname;
        } catch {
          return 'unknown';
        }
      })();

      logger.error('API Route Error', {
        path,
        method: request?.method ?? 'unknown',
        error,
      });

      const mappedResponse = options.onError?.(error, request);
      if (mappedResponse) {
        return mappedResponse;
      }

      if (error instanceof Error) {
        return ApiResponseUtil.error(
          'An unexpected error occurred',
          500,
          error.message
        );
      }

      return ApiResponseUtil.error(
        'An unexpected error occurred',
        500,
        String(error)
      );
    }
  };
}

/**
 * Validation Middleware
 *
 * Validates request body against Zod schema
 *
 * @example
 * const validated = await validateBody(request, CreateExpenseSchema);
 * const expense = await expenseService.create(validated);
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<T> {
  const body = await request.json();
  return schema.parse(body);
}

/**
 * Validate query parameters
 *
 * @example
 * const { page, limit } = validateQuery(request, PaginationSchema);
 */
export function validateQuery<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): T {
  const { searchParams } = new URL(request.url);
  const queryObject = Object.fromEntries(searchParams.entries());
  return schema.parse(queryObject);
}

/**
 * Combined validation and error handler
 *
 * @example
 * export const POST = withValidation(
 *   CreateExpenseSchema,
 *   async (request, validated) => {
 *     const expense = await expenseService.create(validated);
 *     return ApiResponse.created(expense);
 *   }
 * );
 */
export function withValidation<T>(
  schema: ZodSchema<T>,
  handler: (request: NextRequest, validated: T) => Promise<NextResponse>
) {
  return withErrorHandler(async (request: NextRequest) => {
    const validated = await validateBody(request, schema);
    return handler(request, validated);
  });
}

/**
 * Rate Limiting (Simple In-Memory)
 *
 * For production, use Redis or dedicated rate limiting service
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (request: NextRequest) => string; // Custom key generator
}

export function withRateLimit(config: RateLimitConfig) {
  return function <T = unknown>(
    handler: (request: NextRequest, context?: T) => Promise<NextResponse>
  ) {
    return async (request: NextRequest, context?: T): Promise<NextResponse> => {
      const key = config.keyGenerator
        ? config.keyGenerator(request)
        : request.ip || 'anonymous';

      const now = Date.now();
      const record = rateLimitMap.get(key);

      if (!record || now > record.resetAt) {
        // Reset window
        rateLimitMap.set(key, {
          count: 1,
          resetAt: now + config.windowMs,
        });
        return handler(request, context);
      }

      if (record.count >= config.maxRequests) {
        return ApiResponseUtil.tooManyRequests(
          Math.ceil((record.resetAt - now) / 1000)
        );
      }

      record.count += 1;
      return handler(request, context);
    };
  };
}

/**
 * Method Guard
 *
 * Ensure only specific HTTP methods are allowed
 *
 * @example
 * export const handler = withMethodGuard(['GET', 'POST'], async (request) => {
 *   // Only GET and POST allowed
 * });
 */
export function withMethodGuard(
  allowedMethods: string[],
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    if (!allowedMethods.includes(request.method)) {
      return ApiResponseUtil.error(
        `Method ${request.method} not allowed`,
        405,
        `Allowed methods: ${allowedMethods.join(', ')}`
      );
    }
    return handler(request);
  };
}

/**
 * Compose multiple middleware
 *
 * @example
 * export const POST = compose(
 *   withRateLimit({ windowMs: 60000, maxRequests: 10 }),
 *   withValidation(CreateSchema, handler)
 * );
 */
export function compose<T = unknown>(
  ...middlewares: Array<
    (
      handler: (request: NextRequest, context?: T) => Promise<NextResponse>
    ) => (request: NextRequest, context?: T) => Promise<NextResponse>
  >
) {
  return middlewares.reduce((acc, middleware) => middleware(acc), ((
    _request: NextRequest,
    _context?: T
  ) =>
    Promise.resolve(
      NextResponse.json({ error: 'No handler provided' }, { status: 500 })
    )) as (request: NextRequest, context?: T) => Promise<NextResponse>);
}
