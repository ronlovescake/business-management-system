import { redirect } from 'next/navigation';

type AccountingExpensesRedirectPageProps = {
  redirectPath: '/clothing/accounting' | '/general-merchandise/accounting/journal';
};

export function AccountingExpensesRedirectPage({
  redirectPath,
}: AccountingExpensesRedirectPageProps) {
  return redirect(redirectPath);
}