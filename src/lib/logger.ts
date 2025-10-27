/**
 * Logger Utility
 *
 * Provides development-only logging that is automatically stripped in production.
 * This prevents console clutter in production while maintaining debug capabilities during development.
 *
 * Usage:
 * import { logger } from '@/lib/logger';
 *
 * logger.log('User action', data);
 * logger.debug('API', 'Fetching customers');
 * logger.warn('Validation failed', errors);
 * logger.error('Critical error', error); // Always logs, even in production
 */

/* eslint-disable no-console */

import { isDevelopment } from '@/lib/env';

export const logger = {
  /**
   * General logging - only in development
   * Use for general information and debugging
   */
  log: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Debug logging with category - only in development
   * Use for detailed debugging with categorization
   *
   * @example
   * logger.debug('API', 'Fetching transactions');
   * logger.debug('Validation', 'Customer check passed');
   */
  debug: (category: string, ...args: unknown[]): void => {
    if (isDevelopment) {
      console.log(`[${category}]`, ...args);
    }
  },

  /**
   * Warning logging - only in development
   * Use for non-critical issues that should be addressed
   */
  warn: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * Error logging - ALWAYS logs (development and production)
   * Use for critical errors that need investigation
   *
   * In production, these are sent to Sentry for tracking
   */
  error: (...args: unknown[]): void => {
    console.error(...args);

    // Send to Sentry in production
    if (!isDevelopment && typeof window !== 'undefined') {
      // Dynamically import Sentry only when needed
      import('@sentry/nextjs')
        .then((Sentry) => {
          const error = args[0];
          if (error instanceof Error) {
            Sentry.captureException(error);
          } else {
            Sentry.captureMessage(String(error), 'error');
          }
        })
        .catch(() => {
          // Silently fail if Sentry is not available
        });
    }
  },

  /**
   * Info logging with styling - only in development
   * Use for important milestones or state changes
   */
  info: (message: string, ...args: unknown[]): void => {
    if (isDevelopment) {
      console.info(`ℹ️  ${message}`, ...args);
    }
  },

  /**
   * Success logging with styling - only in development
   * Use for successful operations
   */
  success: (message: string, ...args: unknown[]): void => {
    if (isDevelopment) {
      console.log(`✅ ${message}`, ...args);
    }
  },

  /**
   * Table logging - only in development
   * Use for displaying structured data
   */
  table: (data: unknown): void => {
    if (isDevelopment && console.table) {
      console.table(data);
    }
  },

  /**
   * Group logging - only in development
   * Use for grouping related logs
   */
  group: (label: string): void => {
    if (isDevelopment && console.group) {
      console.group(label);
    }
  },

  groupEnd: (): void => {
    if (isDevelopment && console.groupEnd) {
      console.groupEnd();
    }
  },

  /**
   * Time tracking - only in development
   * Use for performance measurement
   */
  time: (label: string): void => {
    if (isDevelopment && console.time) {
      console.time(label);
    }
  },

  timeEnd: (label: string): void => {
    if (isDevelopment && console.timeEnd) {
      console.timeEnd(label);
    }
  },
};

/**
 * Type-safe logger interface
 */
export type Logger = typeof logger;
