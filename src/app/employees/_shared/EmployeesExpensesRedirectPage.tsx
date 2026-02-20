import { redirect } from 'next/navigation';

type EmployeesExpensesRedirectPageProps = {
  redirectPath:
    | '/clothing/accounting'
    | '/general-merchandise/accounting/expenses';
};

export function EmployeesExpensesRedirectPage({
  redirectPath,
}: EmployeesExpensesRedirectPageProps) {
  return redirect(redirectPath);
}
