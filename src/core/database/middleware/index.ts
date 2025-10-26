/**
 * Database Middleware
 *
 * Centralized exports for all Prisma middleware implementations:
 * - Soft Delete: Implements soft-delete pattern with deletedAt filtering
 * - Audit Log: Automatic tracking of all database operations
 *
 * @example
 * ```typescript
 * import { applySoftDeleteMiddleware, applyAuditLogMiddleware } from '@/core/database/middleware';
 *
 * applySoftDeleteMiddleware(prisma);
 * applyAuditLogMiddleware(prisma, auditClient);
 * ```
 */

export { applySoftDeleteMiddleware, SOFT_DELETE_MODELS } from './soft-delete';
export { applyAuditLogMiddleware } from './audit-log';
