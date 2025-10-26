/**
 * Error Types and Interfaces
 * Standardized error types used throughout the application
 */

/**
 * Standard error codes used across the application
 */
export enum ErrorCode {
  // Validation Errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Authentication & Authorization Errors (401, 403)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Resource Errors (404, 409)
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',

  // Business Logic Errors (422)
  INVALID_OPERATION = 'INVALID_OPERATION',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',

  // Database Errors (500)
  DATABASE_ERROR = 'DATABASE_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  CONSTRAINT_FAILED = 'CONSTRAINT_FAILED',

  // System Errors (500, 503)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

/**
 * API error response structure
 * Used for all API error responses
 */
export interface ApiErrorResponse {
  /** User-friendly error message */
  error: string;

  /** Machine-readable error code */
  code?: ErrorCode | string;

  /** Additional context about the error */
  details?: string;

  /** Field name for validation errors */
  field?: string;

  /** Recovery suggestions for the user */
  suggestions?: string[];

  /** ISO 8601 timestamp */
  timestamp?: string;

  /** Request ID for tracking/debugging */
  requestId?: string;
}

/**
 * Custom application error class
 * Extends Error with additional metadata
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode | string,
    public statusCode: number = 500,
    public field?: string,
    public details?: string,
    public suggestions?: string[]
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): ApiErrorResponse {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
      field: this.field,
      suggestions: this.suggestions,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Validation error class
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    field?: string,
    details?: string,
    suggestions?: string[]
  ) {
    super(
      message,
      ErrorCode.VALIDATION_ERROR,
      400,
      field,
      details,
      suggestions
    );
    this.name = 'ValidationError';
  }
}

/**
 * Not found error class
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number, suggestions?: string[]) {
    const message = id
      ? `${resource} with ID ${id} not found`
      : `${resource} not found`;
    super(
      message,
      ErrorCode.NOT_FOUND,
      404,
      undefined,
      message,
      suggestions || [
        'Check if the ID is correct',
        'The record may have been deleted',
      ]
    );
    this.name = 'NotFoundError';
  }
}

/**
 * Duplicate entry error class
 */
export class DuplicateError extends AppError {
  constructor(
    resource: string,
    field: string,
    value?: string,
    suggestions?: string[]
  ) {
    const message = `Duplicate ${resource}`;
    const details = value
      ? `A ${resource} with ${field} '${value}' already exists`
      : `A ${resource} with this ${field} already exists`;
    super(
      message,
      ErrorCode.DUPLICATE_ENTRY,
      409,
      field,
      details,
      suggestions || [
        `Use a different ${field}`,
        'Update the existing record instead',
      ]
    );
    this.name = 'DuplicateError';
  }
}

/**
 * Unauthorized error class
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', suggestions?: string[]) {
    super(
      message,
      ErrorCode.UNAUTHORIZED,
      401,
      undefined,
      message,
      suggestions || [
        'Please log in to continue',
        'Your session may have expired',
      ]
    );
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden error class
 */
export class ForbiddenError extends AppError {
  constructor(
    message = 'You do not have permission to perform this action',
    suggestions?: string[]
  ) {
    super(
      message,
      ErrorCode.FORBIDDEN,
      403,
      undefined,
      message,
      suggestions || ['Contact an administrator if you need access']
    );
    this.name = 'ForbiddenError';
  }
}

/**
 * Constraint violation error class
 */
export class ConstraintError extends AppError {
  constructor(
    message: string,
    field?: string,
    details?: string,
    suggestions?: string[]
  ) {
    super(
      message,
      ErrorCode.CONSTRAINT_VIOLATION,
      422,
      field,
      details,
      suggestions
    );
    this.name = 'ConstraintError';
  }
}

/**
 * Database error class
 */
export class DatabaseError extends AppError {
  constructor(
    message = 'Database operation failed',
    details?: string,
    suggestions?: string[]
  ) {
    super(
      message,
      ErrorCode.DATABASE_ERROR,
      500,
      undefined,
      details,
      suggestions || [
        'Please try again',
        'Contact support if the problem persists',
      ]
    );
    this.name = 'DatabaseError';
  }
}
