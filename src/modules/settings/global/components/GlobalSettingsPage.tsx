'use client';

import { Stack } from '@mantine/core';
import { useGlobalSettingsTabs } from '../hooks/useGlobalSettingsTabs';
import { SettingsToolbar } from './SettingsToolbar';
import { SettingsTabContent } from './SettingsTabContent';

export function GlobalSettingsPage() {
  const { activeTab, setActiveTab, searchValue, onSearchChange, actions } =
    useGlobalSettingsTabs();

  return (
    <Stack gap="lg">
      <SettingsToolbar
        activeTab={activeTab}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onTabChange={setActiveTab}
        actions={actions}
      />

      <SettingsTabContent activeTab={activeTab} />
    </Stack>
  );
}
