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
// DATABASE CONNECTION POOL CONFIGURATION
// ============================================================================
// Optimized for production workloads with proper connection management
// Pool settings are configured via DATABASE_URL query parameters
// ============================================================================

// Connection pool configuration recommendations:
// - connection_limit: Max concurrent connections (default: 10)
//   * Development: 5-10
//   * Production: 10-20 (adjust based on traffic)
//   * Formula: (num_cores * 2) + effective_spindle_count
// - pool_timeout: Time to wait for connection (default: 10s)
//   * Set to 10-30s to prevent indefinite waits
// - connect_timeout: TCP connection timeout (default: 5s)
//   * Set to 5-10s for reliability

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
    // Connection pool settings (can also be set via DATABASE_URL)
    // These are overridden by URL parameters if present
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
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

// ============================================================================
// CONNECTION POOL MONITORING
// ============================================================================

/**
 * Get database connection pool metrics
 * Note: Prisma doesn't expose pool metrics directly, but we can track active queries
 */
let totalQueries = 0;
let slowQueries = 0;

if (typeof prisma.$on === 'function') {
  // Track query start/end for connection monitoring
  prisma.$on('query' as never, (e: QueryEvent) => {
    totalQueries++;
    if (e.duration > 100) {
      slowQueries++;
    }
  });
}

/**
 * Get basic database statistics
 */
export function getDatabaseStats() {
  return {
    totalQueries,
    slowQueries,
    slowQueryPercentage: totalQueries > 0 ? ((slowQueries / totalQueries) * 100).toFixed(2) + '%' : '0%',
    slowQueryThreshold: '100ms',
  };
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Database connection successful');
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed', error);
    return false;
  }
}

/**
 * Gracefully disconnect from database
 * Call this on application shutdown
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    await auditClient.$disconnect();
    logger.info('🔌 Database connections closed');
  } catch (error) {
    logger.error('Error disconnecting from database', error);
  }
}

/**
 * Log current database stats (useful for monitoring)
 */
export function logDatabaseStats() {
  const stats = getDatabaseStats();
  logger.info('📊 Database Statistics', stats);
}
