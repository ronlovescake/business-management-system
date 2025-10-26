/**
 * Clothing Business Barrel Export
 *
 * Consolidates all clothing business modules (employees + operations).
 *
 * Note: Due to naming conflicts, some types are not re-exported here.
 * Import directly from specific modules when needed:
 * - '@/modules/clothing/employees/...'
 * - '@/modules/clothing/operations/...'
 *
 * @example
 * import { leaveRequestService } from '@/modules/clothing/employees/leave-requests';
 * import { CustomerService } from '@/modules/clothing/operations/customers';
 */

// Employees Workspace
// Note: Commented out to avoid naming conflicts with operations
// export * from './employees';

// Operations Workspace
// Note: Commented out to avoid naming conflicts with employees
// export * from './operations';

// Re-export specific services that don't conflict
export { leaveRequestService } from './employees/leave-requests/api';
export { CustomerService } from './operations/customers/services/CustomerService';
export { ProductService } from './operations/products/services/ProductService';
