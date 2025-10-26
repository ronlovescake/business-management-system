/**
 * Audit Log Middleware
 *
 * Automatically tracks all database operations by:
 * - Capturing "before" state for update/delete operations
 * - Recording "after" state for all operations
 * - Logging model, action, targetId, and timestamps to AuditLog table
 * - Handling batch operations with count tracking
 *
 * @example
 * ```typescript
 * import { applyAuditLogMiddleware } from '@/core/database/middleware/audit-log';
 *
 * const auditClient = new PrismaClient();
 * applyAuditLogMiddleware(prisma, auditClient);
 * ```
 */

import type { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

/**
 * Gets a Prisma model delegate for dynamic model access
 */
const getDelegate = (client: PrismaClient, modelName: string) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any)[modelName.charAt(0).toLowerCase() + modelName.slice(1)] as {
    findFirst?: (args: unknown) => Promise<unknown>;
    findMany?: (args: unknown) => Promise<unknown>;
    create?: (args: unknown) => Promise<unknown>;
  };

/**
 * Applies audit logging middleware to a Prisma client instance
 *
 * @param client - Main Prisma client instance to apply middleware to
 * @param auditClient - Separate Prisma client for audit log operations (prevents recursion)
 *
 * @remarks
 * This middleware captures:
 * - Before state: Snapshots data before update/delete/upsert operations
 * - After state: Records the result of all operations
 * - Metadata: Model name, action type, target ID, timestamp
 *
 * The audit log entries are created asynchronously and failures are logged
 * but don't interrupt the main operation.
 *
 * @important
 * A separate auditClient is required to prevent infinite recursion when
 * creating audit log entries.
 */
export function applyAuditLogMiddleware(
  client: PrismaClient,
  auditClient: PrismaClient
): void {
  client.$use(async (params, next) => {
    const model = params.model as string | undefined;

    // Skip audit logging for AuditLog model itself (prevent recursion)
    if (!model || model === 'AuditLog') {
      return next(params);
    }

    // Capture "before" state for update/delete operations
    let before: unknown = null;
    const delegate = getDelegate(auditClient, model);

    if (delegate) {
      try {
        // Single record operations (update, delete, upsert)
        if (['update', 'delete', 'upsert'].includes(params.action)) {
          before = await delegate.findFirst?.({ where: params.args?.where });
        }

        // Batch operations (updateMany, deleteMany)
        if (['updateMany', 'deleteMany'].includes(params.action)) {
          before = await delegate.findMany?.({ where: params.args?.where });
        }
      } catch (error) {
        logger.warn(
          '⚠️ Unable to capture "before" snapshot for audit log.',
          error
        );
      }
    }

    // Execute the main operation
    const result = await next(params);

    // Record audit log entry
    const auditDelegate = getDelegate(auditClient, 'AuditLog');
    if (auditDelegate?.create) {
      try {
        // Extract target ID from result or query params
        const targetId =
          (Array.isArray(result)
            ? undefined
            : // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ((result as any)?.id?.toString?.() ??
              params.args?.where?.id?.toString?.())) ?? null;

        await auditDelegate.create({
          data: {
            model,
            action: params.action,
            targetId,
            before,
            // For batch operations, record count; for single operations, record full result
            after: Array.isArray(result) ? { count: result.length } : result,
          },
        });
      } catch (error) {
        logger.warn('⚠️ Failed to persist audit log entry.', error);
      }
    }

    return result;
  });
}
