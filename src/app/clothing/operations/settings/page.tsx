/**
 * Settings Page Route
 *
 * Renders the Settings module page for module marketplace and configuration
 * Direct import path used to optimize compilation speed.
 */

import { SettingsPage } from '@/modules/clothing/operations/settings/components/SettingsPage';
import { SettingsErrorBoundary } from './components/SettingsErrorBoundary';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export default async function Settings() {
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
