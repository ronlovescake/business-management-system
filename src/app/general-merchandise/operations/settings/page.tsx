/**
 * GM Settings Page Route
 */

import { redirect } from 'next/navigation';

import { SettingsRoutePage } from '@/app/operations/settings/_shared/SettingsRoutePage';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function Settings({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  // Backup & Restore has been centralized under /settings.
  const tab = searchParams?.tab;
  const tabValue = Array.isArray(tab) ? tab[0] : tab;
  if (tabValue === 'backup') {
    redirect('/settings?tab=backup');
  }

  return renderGmOperationsPage(
    '/general-merchandise/operations/settings',
    <SettingsRoutePage apiBasePath="/api/general-merchandise" />
  );
}
