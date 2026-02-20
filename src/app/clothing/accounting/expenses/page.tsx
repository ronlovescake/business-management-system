'use client';

import { ExpensesRoutePage } from '@/app/accounting/_shared/ExpensesRoutePage';

/**
 * Expenses Page Component
 *
 * This is now a thin orchestration layer that:
 * - Uses the useExpenses hook for all business logic
 * - Focuses solely on UI composition and layout
 * - Delegates rendering to specialized components
 *
 * Architecture Benefits:
 * - Business logic is testable in isolation (useExpenses hook)
 * - Page component is ~200 lines instead of 1,643 lines
 * - UI can be easily swapped (e.g., switching from Mantine to another library)
 * - Clear separation of concerns
 */
export default function Expenses() {
  return (
    <ExpensesRoutePage
      addTitle="ADD CLOTHING OPERATIONS EXPENSE"
      editTitle="Edit Clothing Operations Expense"
      addSubtitle="Fill in the details to add a clothing operations expense"
      editSubtitle="Update the clothing operations expense details below"
    />
  );
}
