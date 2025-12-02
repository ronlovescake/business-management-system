/**
 * API Constants
 *
 * Centralized constants for API configuration and limits
 */

/**
 * Batch Operation Limits
 */
export const BATCH_LIMITS = {
  MAX_BATCH_SIZE: 10000,
  MAX_BULK_UPDATE_SIZE: 1000,
  MAX_CSV_IMPORT_SIZE: 10000,
  MAX_BULK_DELETE_SIZE: 5000,
} as const;

/**
 * Pagination Defaults
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 1000,
  MIN_LIMIT: 1,
} as const;

/**
 * Rate Limiting
 */
export const RATE_LIMITS = {
  REQUESTS_PER_MINUTE: 60,
  REQUESTS_PER_HOUR: 1000,
  BURST_LIMIT: 10,
} as const;

/**
 * Timeout Values (in milliseconds)
 */
export const TIMEOUTS = {
  API_REQUEST: 30000, // 30 seconds
  FILE_UPLOAD: 60000, // 60 seconds
  BATCH_OPERATION: 120000, // 2 minutes
  REPORT_GENERATION: 180000, // 3 minutes
} as const;

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  MULTI_STATUS: 207,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Mass Deletion Confirmation Tokens
 */
export const MASS_DELETE_TOKENS = {
  LEAVE_REQUESTS: 'LEAVE_REQUESTS',
  EXPENSES: 'EXPENSES',
  TRANSACTIONS: 'TRANSACTIONS',
  CUSTOMERS: 'CUSTOMERS',
  PRODUCTS: 'PRODUCTS',
  EMPLOYEES: 'EMPLOYEES',
  PAYROLL: 'PAYROLL',
  ATTENDANCE: 'ATTENDANCE',
  SCHEDULES: 'SCHEDULES',
} as const;

export type MassDeleteToken =
  (typeof MASS_DELETE_TOKENS)[keyof typeof MASS_DELETE_TOKENS];
