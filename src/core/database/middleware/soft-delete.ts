/**
 * Soft Delete Middleware
 *
 * Implements soft-delete pattern for specified Prisma models by:
 * - Automatically filtering out soft-deleted records on queries (deletedAt !== null)
 * - Converting delete operations to update operations that set deletedAt timestamp
 * - Maintaining data integrity while allowing data recovery
 *
 * @example
 * ```typescript
 * import { applySoftDeleteMiddleware } from '@/core/database/middleware/soft-delete';
 *
 * applySoftDeleteMiddleware(prisma, new Set(['Customer', 'Product']));
 * ```
 */

import type { PrismaClient } from '@prisma/client';

/**
 * Models that support soft-delete pattern (have deletedAt field)
 */
export const SOFT_DELETE_MODELS = new Set([
  'Customer',
  'Price',
  'Product',
  'Shipment',
  'Transaction',
  'SortingDistribution',
  // Employee Workspace Models
  'Employee',
  'Attendance',
  'Schedule',
  'Payroll',
  // 'LeaveRequest', // TODO: Add deletedAt field to LeaveRequest model to enable soft-delete
  'CashAdvanceRecord',
  'Expense',
  'ThirteenthMonthPayRecord',
]);

/**
 * Ensures deletedAt filter is applied to query where clause
 */
const ensureWhere = (where: Record<string, unknown> | undefined) => ({
  ...where,
  deletedAt: null,
});

/**
 * Applies soft-delete middleware to a Prisma client instance
 *
 * @param client - Prisma client instance to apply middleware to
 * @param models - Set of model names that should use soft-delete (optional, uses SOFT_DELETE_MODELS by default)
 *
 * @remarks
 * This middleware intercepts Prisma operations and:
 * 1. Adds `deletedAt: null` filter to all read queries
 * 2. Converts `delete` to `update` with `deletedAt: new Date()`
 * 3. Converts `deleteMany` to `updateMany` with `deletedAt: new Date()`
 * 4. Converts `findUnique` to `findFirst` with deletedAt filter
 */
export function applySoftDeleteMiddleware(
  client: PrismaClient,
  models: Set<string> = SOFT_DELETE_MODELS
): void {
  client.$use(async (params, next) => {
    const model = params.model as string | undefined;

    // Skip if not a soft-delete model or if it's the AuditLog model
    if (!model || !models.has(model) || model === 'AuditLog') {
      return next(params);
    }

    // Handle different query operations
    switch (params.action) {
      case 'findMany':
      case 'count':
        params.args = params.args ?? {};
        params.args.where = ensureWhere(params.args.where);
        break;

      case 'findFirst':
        params.args = params.args ?? {};
        params.args.where = ensureWhere(params.args.where);
        break;

      case 'findUnique':
        // Convert to findFirst to apply deletedAt filter
        params.action = 'findFirst';
        params.args = params.args ?? {};
        params.args.where = ensureWhere(params.args.where);
        break;

      case 'delete':
        // Convert delete to update with deletedAt timestamp
        params.action = 'update';
        params.args.data = {
          ...(params.args.data ?? {}),
          deletedAt: new Date(),
        };
        break;

      case 'deleteMany':
        // Convert deleteMany to updateMany with deletedAt timestamp
        params.action = 'updateMany';
        params.args = params.args ?? {};
        params.args.data = { deletedAt: new Date() };
        break;

      default:
        break;
    }

    return next(params);
  });
}
