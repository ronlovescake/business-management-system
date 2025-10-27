import { PrismaClient } from '@prisma/client';
import {
  applySoftDeleteMiddleware,
  applyAuditLogMiddleware,
} from '@/core/database/middleware';
import { logger } from '@/lib/logger';
import { isProduction, isFeatureEnabled } from '@/lib/env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// ============================================================================
// QUERY PERFORMANCE MONITORING
// ============================================================================
// Enable query logging with slow query detection (>100ms threshold)
// ============================================================================

/**
 * Query event interface from Prisma
 */
interface QueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  });

// Log slow queries (>100ms) in development and production
// Check if $on method exists (not available in test mocks)
if (typeof prisma.$on === 'function') {
  prisma.$on('query' as never, (e: QueryEvent) => {
    const duration = e.duration;
    const query = e.query;
    const params = e.params;

    // Log slow queries for performance monitoring
    if (duration > 100) {
      logger.warn('🐌 Slow query detected', {
        duration: `${duration}ms`,
        query: query.substring(0, 200), // Truncate long queries
        params,
        threshold: '100ms',
      });
    }

    // In development, log all queries for debugging (optional)
    if (isFeatureEnabled('query-logging')) {
      logger.debug('📊 Query executed', {
        duration: `${duration}ms`,
        query: query.substring(0, 150),
      });
    }
  });
}

// Separate client for audit logging to prevent recursion
const auditClient = new PrismaClient();

// Apply middleware
applySoftDeleteMiddleware(prisma);
applyAuditLogMiddleware(prisma, auditClient);

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
