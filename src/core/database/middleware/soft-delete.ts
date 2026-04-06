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
 * Models that support soft-delete pattern (have deletedAt field).
 *
 * Policy:
 * - Business-domain records default to soft delete when they expose a `deletedAt` column.
 * - Messaging/auth/system records that still intentionally hard-delete stay out of this set.
 * - Explicit hard-delete exceptions today: `Message`, `Conversation`, and `User`.
 */
export const SOFT_DELETE_MODELS = new Set([
  'Customer',
  'AdditionalCustomerInfo',
  'Price',
  'Product',
  'InventoryMovement',
  'ClothingInventoryReclassEntry',
  'ClothingInventoryTransitBuildEntry',
  'Shipment',
  'Transaction',
  'TransactionPayment',
  'TransactionRefund',
  'GeneralMerchandiseTransaction',
  'SortingDistribution',
  'CheckoutLink',
  'ItemWeight',
  'Invoice',
  'ShippingFeeCalculatorState',
  // Employee Workspace Models
  'Employee',
  'LeaveRequest',
  'Attendance',
  'Schedule',
  'Payroll',
  'SalaryHistory',
  'CashAdvanceRecord',
  'Expense',
  // Trucking Domain Models
  'TruckingFleetRegistry',
  'TruckingTrip',
  'TruckingVehicleAssignment',
  'TruckingEmployee',
  'TruckingLeaveRequest',
  'TruckingAttendance',
  'TruckingSchedule',
  'TruckingPayroll',
  'TruckingSalaryHistory',
  'TruckingCashAdvanceRecord',
  'TruckingExpense',
  // General Merchandise Domain Models
  'GeneralMerchandiseCustomer',
  'GeneralMerchandiseAdditionalCustomerInfo',
  'GeneralMerchandisePrice',
  'GeneralMerchandiseProduct',
  'GeneralMerchandiseInventoryMovement',
  'GeneralMerchandiseInventoryReclassEntry',
  'GeneralMerchandiseInventoryTransitBuildEntry',
  'GeneralMerchandiseShipment',
  'GeneralMerchandiseTransactionPayment',
  'GeneralMerchandiseTransactionRefund',
  'GeneralMerchandiseSortingDistribution',
  'GeneralMerchandiseCheckoutLink',
  'GeneralMerchandiseItemWeight',
  'GeneralMerchandiseInvoice',
  'GeneralMerchandiseShippingFeeCalculatorState',
  'GeneralMerchandiseEmployee',
  'GeneralMerchandiseLeaveRequest',
  'GeneralMerchandiseAttendance',
  'GeneralMerchandiseSchedule',
  'GeneralMerchandisePayroll',
  'GeneralMerchandiseSalaryHistory',
  'GeneralMerchandiseCashAdvanceRecord',
  'GeneralMerchandiseExpense',
  // NOTE: 'ThirteenthMonthPayRecord' excluded - does NOT have deletedAt field in schema
  // NOTE: 'Message', 'Conversation', and 'User' intentionally remain hard-delete models.
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
