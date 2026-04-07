import { redirect } from 'next/navigation';

type AccountingRootRedirectPageProps = {
  businessPathPrefix: '/clothing' | '/general-merchandise';
  defaultSection?: 'expenses' | 'journal' | 'ledger' | 'profit-loss';
};

export function AccountingRootRedirectPage({
  businessPathPrefix,
  defaultSection = 'expenses',
}: AccountingRootRedirectPageProps) {
  return redirect(`${businessPathPrefix}/accounting/${defaultSection}`);
}
