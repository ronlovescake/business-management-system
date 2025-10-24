/**
 * Mass Deletion Protection Utilities
 *
 * Provides safety checks for bulk deletion operations to prevent
 * accidental data loss.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export type MassDeleteContext =
  | 'EMPLOYEES'
  | 'ATTENDANCE'
  | 'SCHEDULES'
  | 'PAYROLL'
  | 'LEAVE_REQUESTS'
  | 'EXPENSES'
  | 'CASH_ADVANCES';

const CONFIRMATION_TOKENS: Record<MassDeleteContext, string> = {
  EMPLOYEES: 'DELETE_ALL_EMPLOYEES',
  ATTENDANCE: 'DELETE_ALL_ATTENDANCE',
  SCHEDULES: 'DELETE_ALL_SCHEDULES',
  PAYROLL: 'DELETE_ALL_PAYROLL',
  LEAVE_REQUESTS: 'DELETE_ALL_LEAVE_REQUESTS',
  EXPENSES: 'DELETE_ALL_EXPENSES',
  CASH_ADVANCES: 'DELETE_ALL_CASH_ADVANCES',
};

/**
 * Validates that the user has provided the required confirmation token
 * for a mass deletion operation.
 *
 * @param request - The Next.js request object
 * @param context - The context/type of records being deleted
 * @returns NextResponse with 400 error if token is missing, null if valid
 *
 * @example
 * ```typescript
 * const validation = validateMassDeleteConfirmation(request, 'EMPLOYEES');
 * if (validation) return validation; // Return error response
 * // Proceed with deletion
 * ```
 */
export function validateMassDeleteConfirmation(
  request: NextRequest,
  context: MassDeleteContext
): NextResponse | null {
  const { searchParams } = new URL(request.url);
  const confirmToken = searchParams.get('confirm');
  const expectedToken = CONFIRMATION_TOKENS[context];

  if (confirmToken !== expectedToken) {
    const contextName = context
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());

    return NextResponse.json(
      {
        error: 'Mass deletion protection',
        message: `This operation will delete ALL ${contextName.toLowerCase()} records. This action cannot be undone.`,
        details: `To proceed, you must provide a confirmation token in the query parameters.`,
        requiredParameter: 'confirm',
        requiredValue: expectedToken,
        example: `/api/${context.toLowerCase().replace(/_/g, '-')}?confirm=${expectedToken}`,
        warning: [
          '⚠️  This is a destructive operation that affects multiple records.',
          '⚠️  Soft delete will still preserve the data for recovery.',
          '⚠️  Make sure you have a backup before proceeding.',
        ].join('\n'),
      },
      { status: 400 }
    );
  }

  return null;
}

/**
 * Gets the expected confirmation token for a given context
 */
export function getConfirmationToken(context: MassDeleteContext): string {
  return CONFIRMATION_TOKENS[context];
}
