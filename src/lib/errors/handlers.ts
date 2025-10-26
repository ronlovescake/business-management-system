/**
 * Error Handler Utilities
 * Standardized error handling functions for API routes and client code
 */

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import type { ApiErrorResponse } from './types';
import {
  AppError,
  ErrorCode,
  NotFoundError,
  DuplicateError,
  ConstraintError,
  DatabaseError,
} from './types';

/**
 * Handle Prisma-specific errors
 */
export function handlePrismaError(
  error: Prisma.PrismaClientKnownRequestError
): NextResponse<ApiErrorResponse> {
  switch (error.code) {
    case 'P2002': {
      // Unique constraint violation
      const target = (error.meta?.target as string[]) || ['field'];
      const field = target[0];
      const appError = new DuplicateError('record', field);
      return NextResponse.json(appError.toJSON(), { status: 409 });
    }

    case 'P2025': {
      // Record not found
      const appError = new NotFoundError('Record');
      return NextResponse.json(appError.toJSON(), { status: 404 });
    }

    case 'P2003': {
      // Foreign key constraint failed
      const field = error.meta?.field_name as string;
      const appError = new ConstraintError(
        'Invalid reference',
        field,
        'Referenced record does not exist',
        [
          'Check if the referenced record exists',
          'Create the referenced record first',
        ]
      );
      return NextResponse.json(appError.toJSON(), { status: 422 });
    }

    case 'P2014': {
      // Required relation violation
      const relation = error.meta?.relation_name as string;
      const appError = new ConstraintError(
        'Missing required relation',
        relation,
        `The relation '${relation}' is required but not provided`,
        ['Provide all required relationships']
      );
      return NextResponse.json(appError.toJSON(), { status: 422 });
    }

    case 'P2015': {
      // Related record not found
      const appError = new NotFoundError('Related record');
      return NextResponse.json(appError.toJSON(), { status: 404 });
    }

    case 'P2016': {
      // Query interpretation error
      const appError = new AppError(
        'Invalid query',
        ErrorCode.INVALID_INPUT,
        400,
        undefined,
        'The query could not be interpreted',
        ['Check your request parameters']
      );
      return NextResponse.json(appError.toJSON(), { status: 400 });
    }

    case 'P2021': {
      // Table does not exist
      const table = error.meta?.table as string;
      logger.error('Database schema error - table does not exist', {
        table,
        code: error.code,
      });
      const appError = new DatabaseError(
        'Database configuration error',
        'A required database table is missing',
        ['Contact system administrator']
      );
      return NextResponse.json(appError.toJSON(), { status: 500 });
    }

    case 'P2022': {
      // Column does not exist
      const column = error.meta?.column as string;
      logger.error('Database schema error - column does not exist', {
        column,
        code: error.code,
      });
      const appError = new DatabaseError(
        'Database configuration error',
        'A required database column is missing',
        ['Contact system administrator']
      );
      return NextResponse.json(appError.toJSON(), { status: 500 });
    }

    default: {
      logger.error('Unhandled Prisma error', {
        code: error.code,
        meta: error.meta,
        message: error.message,
      });
      const appError = new DatabaseError();
      return NextResponse.json(appError.toJSON(), { status: 500 });
    }
  }
}

/**
 * Handle AppError instances
 */
export function handleAppError(
  error: AppError
): NextResponse<ApiErrorResponse> {
  // Log the error if it's a server error (5xx)
  if (error.statusCode >= 500) {
    logger.error('Application error', {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      field: error.field,
      details: error.details,
      stack: error.stack,
    });
  }

  return NextResponse.json(error.toJSON(), { status: error.statusCode });
}

/**
 * Handle unknown errors (fallback)
 */
export function handleUnknownError(
  error: unknown,
  context?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  // Log the unexpected error
  logger.error('Unexpected error', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    context,
  });

  const appError = new AppError(
    'Unable to process your request',
    ErrorCode.INTERNAL_ERROR,
    500,
    undefined,
    'An unexpected error occurred',
    ['Please try again', 'Contact support if the problem persists']
  );

  return NextResponse.json(appError.toJSON(), { status: 500 });
}

/**
 * Generic error handler for API routes
 * Automatically handles different error types
 */
export function handleApiError(
  error: unknown,
  context?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  // Handle AppError instances
  if (error instanceof AppError) {
    return handleAppError(error);
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(error);
  }

  // Handle Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    logger.error('Prisma validation error', {
      message: error.message,
      context,
    });
    const appError = new AppError(
      'Invalid data format',
      ErrorCode.VALIDATION_ERROR,
      400,
      undefined,
      'The provided data does not match the expected format',
      ['Check your request data format']
    );
    return NextResponse.json(appError.toJSON(), { status: 400 });
  }

  // Handle Prisma client initialization errors
  if (error instanceof Prisma.PrismaClientInitializationError) {
    logger.error('Prisma client initialization error', {
      message: error.message,
      context,
    });
    const appError = new AppError(
      'Database connection failed',
      ErrorCode.SERVICE_UNAVAILABLE,
      503,
      undefined,
      'Unable to connect to the database',
      [
        'Please try again in a few moments',
        'Contact support if the problem persists',
      ]
    );
    return NextResponse.json(appError.toJSON(), { status: 503 });
  }

  // Handle Prisma client runtime errors
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    logger.error('Prisma runtime panic', {
      message: error.message,
      context,
    });
    const appError = new DatabaseError(
      'Database operation failed',
      'A critical database error occurred',
      ['Contact support immediately']
    );
    return NextResponse.json(appError.toJSON(), { status: 500 });
  }

  // Handle generic errors
  if (error instanceof Error) {
    // Check if it's a network/timeout error
    if (
      error.message.includes('timeout') ||
      error.message.includes('ETIMEDOUT')
    ) {
      const appError = new AppError(
        'Request timeout',
        ErrorCode.TIMEOUT,
        504,
        undefined,
        'The operation took too long to complete',
        ['Please try again', 'Try reducing the amount of data requested']
      );
      return NextResponse.json(appError.toJSON(), { status: 504 });
    }

    logger.error('Generic error', {
      message: error.message,
      stack: error.stack,
      context,
    });
  }

  // Fallback to unknown error handler
  return handleUnknownError(error, context);
}

/**
 * Wrapper for API route handlers with automatic error handling
 */
export function withErrorHandler<T extends unknown[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | NextResponse<ApiErrorResponse>> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/**
 * Create a standard validation error response
 */
export function createValidationError(
  field: string,
  message: string,
  details?: string
): NextResponse<ApiErrorResponse> {
  const error: ApiErrorResponse = {
    error: message,
    code: ErrorCode.VALIDATION_ERROR,
    field,
    details,
    suggestions: [`Please provide a valid ${field}`],
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(error, { status: 400 });
}

/**
 * Create a standard not found error response
 */
export function createNotFoundError(
  resource: string,
  id?: string | number
): NextResponse<ApiErrorResponse> {
  const appError = new NotFoundError(resource, id);
  return NextResponse.json(appError.toJSON(), { status: 404 });
}

/**
 * Create a standard duplicate error response
 */
export function createDuplicateError(
  resource: string,
  field: string,
  value?: string
): NextResponse<ApiErrorResponse> {
  const appError = new DuplicateError(resource, field, value);
  return NextResponse.json(appError.toJSON(), { status: 409 });
}

/**
 * Extract API error from caught exception
 * Useful for client-side error handling
 */
export function extractApiError(error: unknown): ApiErrorResponse {
  // If it's already an ApiErrorResponse
  if (
    error &&
    typeof error === 'object' &&
    'error' in error &&
    typeof error.error === 'string'
  ) {
    return error as ApiErrorResponse;
  }

  // If it's an Error with a response (from fetch/axios)
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    if (response?.data) {
      return extractApiError(response.data);
    }
  }

  // If it's a generic Error
  if (error instanceof Error) {
    return {
      error: error.message,
      code: ErrorCode.INTERNAL_ERROR,
    };
  }

  // Fallback
  return {
    error: 'An unexpected error occurred',
    code: ErrorCode.INTERNAL_ERROR,
  };
}
