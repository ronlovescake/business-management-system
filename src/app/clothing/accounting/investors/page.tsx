import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import InvestorsPage from '@/modules/clothing/accounting/investors/InvestorsPage';

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    redirect('/clothing/operations');
  }
  return <InvestorsPage />;
}
