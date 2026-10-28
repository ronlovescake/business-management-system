import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getRequiredRolesForPath } from '@/core/routePermissions';
import { getCurrentUser } from '@/lib/auth/session';
import { HandbookPage } from '@/modules/clothing/operations/handbook/HandbookPage';
import { HANDBOOK_PATH } from '@/modules/clothing/operations/handbook/handbook';
import { loadHandbook } from '@/modules/clothing/operations/handbook/loadHandbook.server';

export const metadata: Metadata = {
  title: 'Employee Handbook | Clothing',
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (
    !getRequiredRolesForPath(HANDBOOK_PATH)?.some((role) => role === user.role)
  ) {
    notFound();
  }

  return <HandbookPage procedures={await loadHandbook()} />;
}
