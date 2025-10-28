/**
 * Settings Page Route
 *
 * Renders the Settings module page for module marketplace and configuration
 * Direct import path used to optimize compilation speed.
 */

import { SettingsPage } from '@/modules/clothing/operations/settings/components/SettingsPage'
import { SettingsErrorBoundary } from './components/SettingsErrorBoundary';;

export default function Settings() {
  return (
    <SettingsErrorBoundary>
      <SettingsPage />
    </SettingsErrorBoundary>
  );;
}
