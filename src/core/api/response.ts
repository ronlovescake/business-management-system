/**
 * API Response Utilities
 *
 * Centralized utilities for creating consistent API responses
 */

import { NextResponse } from 'next/server';
import { HTTP_STATUS } from '@/shared/constants/api';
import type {
  ApiResponse as ApiResponseType,
  ApiErrorResponse,
  PaginatedResponse,
  BatchOperationResponse,
} from '@/types/api';

/**
 * ApiResponse Utility Class
 *
 * Provides standardized methods for creating API responses
 *
 * @example
 * ```typescript
 * // Success response
 * return ApiResponse.success({ id: 1, name: 'John' });
 *
 * // Error response
 * return ApiResponse.error('Not found', 404);
 *
 * // Paginated response
 * return ApiResponse.paginated(items, { page: 1, limit: 50, total: 100 });
 * ```
 */
export class ApiResponseUtil {
  /**
   * Create a successful response
   */
  static success<T>(
    data: T,
    message?: string,
    status = HTTP_STATUS.OK
  ): NextResponse<ApiResponseType<T>> {
    return NextResponse.json(
      {
        success: true,
        data,
        message,
      },
      { status }
    );
  }

  /**
   * Create an error response
   */
  static error(
    error: string,
    status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    details?: string,
    options?: {
      field?: string;
      validationErrors?: Record<string, string>;
      suggestion?: string;
      meta?: Record<string, unknown>;
    }
  ): NextResponse<ApiErrorResponse> {
    return NextResponse.json(
      {
        success: false,
        error,
        details,
        ...options,
      },
      { status }
    );
  }

  /**
   * Create a paginated response
   */
  static paginated<T>(
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
    }
  ): NextResponse<PaginatedResponse<T>> {
    const pages = Math.ceil(pagination.total / pagination.limit);

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        ...pagination,
        pages,
      },
    });
  }

  /**
   * Create a batch operation response
   */
  static batch(
    count: number,
    message: string,
    errors?: Array<{ index: number; error: string }>
  ): NextResponse<BatchOperationResponse> {
    return NextResponse.json({
      success: !errors || errors.length === 0,
      count,
      message,
      errors,
    });
  }

  /**
   * Create a "not found" error response
   */
  static notFound(resource = 'Resource'): NextResponse<ApiErrorResponse> {
    return this.error(
      `${resource} not found`,
      HTTP_STATUS.NOT_FOUND,
      `The requested ${resource.toLowerCase()} does not exist or has been deleted`
    );
  }

  /**
   * Create a "bad request" error response
   */
  static badRequest(
    error: string,
    validationErrors?: Record<string, string>
  ): NextResponse<ApiErrorResponse> {
    return this.error(error, HTTP_STATUS.BAD_REQUEST, undefined, {
      validationErrors,
    });
  }

  /**
   * Create an "unauthorized" error response
   */
  static unauthorized(
    message = 'Authentication required'
  ): NextResponse<ApiErrorResponse> {
    return this.error(message, HTTP_STATUS.UNAUTHORIZED);
  }

  /**
   * Create a "forbidden" error response
   */
  static forbidden(
    message = 'Insufficient permissions'
  ): NextResponse<ApiErrorResponse> {
    return this.error(message, HTTP_STATUS.FORBIDDEN);
  }

  /**
   * Create a "conflict" error response
   */
  static conflict(
    error: string,
    details?: string,
    field?: string
  ): NextResponse<ApiErrorResponse> {
    return this.error(error, HTTP_STATUS.CONFLICT, details, { field });
  }

  /**
   * Create a "payload too large" error response
   */
  static payloadTooLarge(
    currentSize: number,
    maxSize: number
  ): NextResponse<ApiErrorResponse> {
    return this.error(
      'Batch size limit exceeded',
      HTTP_STATUS.PAYLOAD_TOO_LARGE,
      `You are trying to import ${currentSize} records. Maximum is ${maxSize} records per import.`,
      {
        suggestion: `Please split your import into smaller batches of ${maxSize} records or less.`,
      }
    );
  }

  /**
   * Create a "too many requests" error response
   */
  static tooManyRequests(retryAfter?: number): NextResponse<ApiErrorResponse> {
    const response = this.error(
      'Too many requests',
      HTTP_STATUS.TOO_MANY_REQUESTS,
      'You have exceeded the rate limit. Please try again later.'
    );

    if (retryAfter) {
      response.headers.set('Retry-After', retryAfter.toString());
    }

    return response;
  }
}

// Export singleton instance
export const ApiResponse = ApiResponseUtil;
