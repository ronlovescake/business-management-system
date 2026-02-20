'use client';

import { ExpensesRoutePage } from '@/app/accounting/_shared/ExpensesRoutePage';
import { useGeneralMerchandiseExpenseData } from '@/hooks/useSheetData';

export default function GeneralMerchandiseExpensesPage() {
  return (
    <ExpensesRoutePage
      expenseDataHook={useGeneralMerchandiseExpenseData}
      addTitle="ADD GENERAL MERCHANDISE OPERATIONS EXPENSE"
      editTitle="Edit General Merchandise Operations Expense"
      addSubtitle="Fill in the details to add a general merchandise operations expense"
      editSubtitle="Update the general merchandise operations expense details below"
    />
  );
}
