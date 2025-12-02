/**
 * Centralized environment variable validation and access
 *
 * This module provides type-safe access to environment variables with runtime validation.
 * All environment variables should be accessed through this module to ensure they are
 * properly validated and typed.
 *
 * @example
 * ```typescript
 * import { env } from '@/lib/env';
 *
 * // Type-safe access
 * const dbUrl = env.DATABASE_URL;
 * const isDev = env.NODE_ENV === 'development';
 * ```
 */

import { z } from 'zod';
import { logger } from '@/lib/logger';

/**
 * Schema for server-side environment variables
 * These are only available in Node.js environment (API routes, server components)
 */
const serverSchema = z.object({
  // Node environment
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  // Database (not required in test environment - tests use mocks)
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a valid PostgreSQL connection URL')
    .optional(),

  // Authentication (optional for now, will be required when implementing auth)
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),

  // Email / SMTP configuration (optional locally, required for password reset emails)
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z
    .preprocess((val) => (val ? Number(val) : undefined), z.number().int())
    .optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),

  // Query logging (optional)
  LOG_ALL_QUERIES: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .default('false'),
});

/**
 * Schema for client-side environment variables
 * These must be prefixed with NEXT_PUBLIC_ to be exposed to the browser
 */
const clientSchema = z.object({
  // Application base URL (for absolute URLs in emails, API calls, etc.)
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Sentry DSN for error tracking (empty string allowed for test environments)
  NEXT_PUBLIC_SENTRY_DSN: z
    .string()
    .transform((val) => val || undefined)
    .pipe(z.string().url().optional())
    .optional(),

  // Add more client-side vars as needed with NEXT_PUBLIC_ prefix
  // NEXT_PUBLIC_API_URL: z.string().url().optional(),
});

/**
 * Combined schema for all environment variables
 */
const envSchema = serverSchema.merge(clientSchema);

/**
 * Type of validated environment variables
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Validate and parse environment variables
 *
 * @throws {Error} If environment variables are invalid
 */
function validateEnv(): Env {
  try {
    const parsed = envSchema.parse(process.env);

    if (process.env.NODE_ENV === 'development') {
      logger.success('Environment variables validated successfully');
    }

    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.errors
        .map((err) => {
          return `  - ${err.path.join('.')}: ${err.message}`;
        })
        .join('\n');

      const errorMessage = `❌ Invalid environment variables:\n${issues}`;
      logger.error(errorMessage);

      throw new Error(errorMessage);
    }

    throw error;
  }
}

/**
 * Validated and typed environment variables
 *
 * This object provides type-safe access to all environment variables.
 * It throws an error at startup if any required variables are missing or invalid.
 *
 * @example
 * ```typescript
 * import { env } from '@/lib/env';
 *
 * // Type-safe access with autocomplete
 * console.log(env.NODE_ENV); // 'development' | 'test' | 'production'
 * console.log(env.DATABASE_URL); // string | undefined
 * console.log(env.LOG_ALL_QUERIES); // boolean
 * ```
 */
export const env = validateEnv();

/**
 * Get DATABASE_URL with validation
 * Throws an error if not set (except in test environment)
 */
export function getDatabaseUrl(): string {
  if (env.NODE_ENV === 'test') {
    return 'postgresql://test:test@localhost:5432/test';
  }

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  return env.DATABASE_URL;
}

/**
 * Check if running in development mode
 */
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * Check if running in production mode
 */
export const isProduction = env.NODE_ENV === 'production';

/**
 * Check if running in test mode
 */
export const isTest = env.NODE_ENV === 'test';

/**
 * Helper to check if a feature should be enabled based on environment
 *
 * @example
 * ```typescript
 * if (isFeatureEnabled('debug-panel')) {
 *   // Show debug panel in development/test
 * }
 * ```
 */
export function isFeatureEnabled(
  feature: 'debug-panel' | 'verbose-logging' | 'query-logging'
): boolean {
  switch (feature) {
    case 'debug-panel':
      return !isProduction;
    case 'verbose-logging':
      return isDevelopment;
    case 'query-logging':
      return env.LOG_ALL_QUERIES;
    default:
      return false;
  }
}

/**
 * Get the application base URL
 * Falls back to localhost:3000 in development if not set
 *
 * @example
 * ```typescript
 * const baseUrl = getBaseUrl(); // "http://localhost:3000" or env value
 * const apiUrl = `${getBaseUrl()}/api/customers`;
 * ```
 */
export function getBaseUrl(): string {
  // Client-side: use window.location.origin if available
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Server-side: use environment variable or default
  if (env.NEXT_PUBLIC_APP_URL) {
    return env.NEXT_PUBLIC_APP_URL;
  }

  // Development fallback
  if (isDevelopment) {
    return 'http://localhost:3000';
  }

  throw new Error('NEXT_PUBLIC_APP_URL must be set in production');
}
