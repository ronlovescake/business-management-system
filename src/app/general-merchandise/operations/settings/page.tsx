/**
 * GM Settings Page Route
 */

import { redirect } from 'next/navigation';

import { SettingsPage } from '@/modules/clothing/operations/settings/components/SettingsPage';
import { SettingsErrorBoundary } from '@/app/clothing/operations/settings/components/SettingsErrorBoundary';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function Settings({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  // Backup & Restore has been centralized under /admin.
  const tab = searchParams?.tab;
  const tabValue = Array.isArray(tab) ? tab[0] : tab;
  if (tabValue === 'backup') {
    redirect('/admin/backup-restore');
  }

  return renderGmOperationsPage(
    '/general-merchandise/operations/settings',
    <SettingsErrorBoundary>
      <SettingsPage apiBasePath="/api/general-merchandise" />
    </SettingsErrorBoundary>
  );
}
