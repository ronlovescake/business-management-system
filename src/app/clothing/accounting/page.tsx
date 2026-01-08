import { redirect } from 'next/navigation';

export default function AccountingRootRedirect() {
  return redirect('/clothing/accounting/expenses');
}
