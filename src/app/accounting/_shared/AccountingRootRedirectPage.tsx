import { redirect } from 'next/navigation';

type AccountingRootRedirectPageProps = {
  businessPathPrefix: '/clothing' | '/general-merchandise';
};

export function AccountingRootRedirectPage({
  businessPathPrefix,
}: AccountingRootRedirectPageProps) {
  return redirect(`${businessPathPrefix}/accounting/expenses`);
}
