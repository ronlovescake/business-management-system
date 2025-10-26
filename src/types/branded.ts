/**
 * Branded Types
 *
 * Branded types provide compile-time type safety for primitive types
 * that should not be interchangeable even if their underlying type is the same.
 *
 * Example:
 * ```typescript
 * type EmployeeId = Brand<string, 'EmployeeId'>;
 * type CustomerId = Brand<string, 'CustomerId'>;
 *
 * // These are not interchangeable even though both are strings
 * function getEmployee(id: EmployeeId) { ... }
 * const customerId: CustomerId = 'CUST-001' as CustomerId;
 * getEmployee(customerId); // ❌ Type error!
 * ```
 */

declare const __brand: unique symbol;

/**
 * Brand<T, B> creates a branded type from base type T with brand B
 */
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

/**
 * Common ID types used throughout the application
 */
export type EmployeeId = Brand<string, 'EmployeeId'>;
export type CustomerId = Brand<string, 'CustomerId'>;
export type ProductId = Brand<string, 'ProductId'>;
export type TransactionId = Brand<number, 'TransactionId'>;
export type LeaveRequestId = Brand<number, 'LeaveRequestId'>;
export type ExpenseId = Brand<number, 'ExpenseId'>;
export type PayrollId = Brand<number, 'PayrollId'>;
export type AttendanceId = Brand<number, 'AttendanceId'>;
export type ScheduleId = Brand<number, 'ScheduleId'>;
export type ShipmentId = Brand<number, 'ShipmentId'>;
export type PriceId = Brand<number, 'PriceId'>;

/**
 * Helper functions to create branded types safely
 */
export const BrandedId = {
  employee: (id: string): EmployeeId => id as EmployeeId,
  customer: (id: string): CustomerId => id as CustomerId,
  product: (id: string): ProductId => id as ProductId,
  transaction: (id: number): TransactionId => id as TransactionId,
  leaveRequest: (id: number): LeaveRequestId => id as LeaveRequestId,
  expense: (id: number): ExpenseId => id as ExpenseId,
  payroll: (id: number): PayrollId => id as PayrollId,
  attendance: (id: number): AttendanceId => id as AttendanceId,
  schedule: (id: number): ScheduleId => id as ScheduleId,
  shipment: (id: number): ShipmentId => id as ShipmentId,
  price: (id: number): PriceId => id as PriceId,
};

/**
 * Helper to unwrap branded types back to their base type
 */
export type Unbrand<T> = T extends Brand<infer U, string> ? U : T;
