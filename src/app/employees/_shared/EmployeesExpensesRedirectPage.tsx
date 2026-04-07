import { redirect } from 'next/navigation';

type EmployeesExpensesRedirectPageProps = {
  redirectPath:
    | '/clothing/accounting'
    | '/general-merchandise/accounting/journal';
};

export function EmployeesExpensesRedirectPage({
  redirectPath,
}: EmployeesExpensesRedirectPageProps) {
  return redirect(redirectPath);
}
