/**
 * Error Export Module
 * Central export point for all error handling utilities
 */

// Types and Classes
export {
  ErrorCode,
  AppError,
  ValidationError,
  NotFoundError,
  DuplicateError,
  UnauthorizedError,
  ForbiddenError,
  ConstraintError,
  DatabaseError,
} from './types';

export type { ApiErrorResponse } from './types';

// Handlers
export {
  handlePrismaError,
  handleAppError,
  handleUnknownError,
  handleApiError,
  withErrorHandler,
  createValidationError,
  createNotFoundError,
  createDuplicateError,
  extractApiError,
} from './handlers';
