/**
 * Prisma Type Utilities
 *
 * This file provides type-safe utilities for working with Prisma models dynamically.
 * Helps eliminate `as any` type assertions when accessing models by name.
 */

import type { PrismaClient } from '@prisma/client';

/**
 * Type-safe Prisma model names
 */
export type PrismaModelName = Exclude<
  keyof PrismaClient,
  | '$connect'
  | '$disconnect'
  | '$on'
  | '$transaction'
  | '$use'
  | '$extends'
  | '$executeRaw'
  | '$executeRawUnsafe'
  | '$queryRaw'
  | '$queryRawUnsafe'
  | symbol
>;

/**
 * Type-safe model delegate accessor
 * Returns the correct Prisma delegate type for a given model name
 */
export type PrismaModelDelegate<T extends PrismaModelName> =
  PrismaClient[T] extends { findMany: (...args: unknown[]) => unknown }
    ? PrismaClient[T]
    : never;

/**
 * Helper to get a Prisma model delegate in a type-safe way
 *
 * @example
 * const customerDelegate = getPrismaModel(prisma, 'customer');
 * const customers = await customerDelegate.findMany();
 */
export function getPrismaModel<T extends PrismaModelName>(
  prisma: PrismaClient,
  modelName: T
): PrismaModelDelegate<T> {
  return prisma[modelName] as PrismaModelDelegate<T>;
}

/**
 * Type guard to check if a string is a valid Prisma model name
 */
export function isPrismaModelName(
  modelName: string
): modelName is PrismaModelName {
  const validModels: PrismaModelName[] = [
    'attendance',
    'auditLog',
    'changeLog',
    'cashAdvanceDeduction',
    'cashAdvanceRecord',
    'customer',
    'employee',
    'employeeAutomationSetting',
    'expense',
    'healthCheck',
    'householdAccount',
    'householdExpense',
    'householdIncome',
    'installedModule',
    'leaveRequest',
    'moduleMarketplace',
    'payroll',
    'price',
    'product',
    'schedule',
    'shipment',
    'thirteenthMonthPayRecord',
    'transaction',
  ];
  return validModels.includes(modelName as PrismaModelName);
}

/**
 * Utility type for Prisma where clauses
 */
export type PrismaWhere<T extends PrismaModelName> = Parameters<
  PrismaModelDelegate<T>['findMany']
>[0] extends { where?: infer W }
  ? W
  : never;

/**
 * Utility type for Prisma select clauses
 */
export type PrismaSelect<T extends PrismaModelName> = Parameters<
  PrismaModelDelegate<T>['findMany']
>[0] extends { select?: infer S }
  ? S
  : never;

/**
 * Utility type for Prisma include clauses
 */
export type PrismaInclude<T extends PrismaModelName> = Parameters<
  PrismaModelDelegate<T>['findMany']
>[0] extends { include?: infer I }
  ? I
  : never;
