/**
 * Settings Page Route
 *
 * Renders the Settings module page for module marketplace and configuration
 * Direct import path used to optimize compilation speed.
 */

import { redirect } from 'next/navigation';

import { SettingsRoutePage } from '@/app/operations/settings/_shared/SettingsRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

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

  return renderOperationsPage(
    '/clothing/operations/settings',
    <SettingsRoutePage />
  );
}
