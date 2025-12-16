/**
 * Settings Page Route
 *
 * Renders the Settings module page for module marketplace and configuration
 * Direct import path used to optimize compilation speed.
 */

import { redirect } from 'next/navigation';

import { SettingsPage } from '@/modules/clothing/operations/settings/components/SettingsPage';
import { SettingsErrorBoundary } from './components/SettingsErrorBoundary';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

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

  const hasAccess = await hasModuleAccess('/clothing/operations/settings');
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <SettingsErrorBoundary>
        <SettingsPage />
      </SettingsErrorBoundary>
    </PermissionGuard>
  );
}
