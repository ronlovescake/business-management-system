import type { MantineColor } from '@mantine/core';

export type GlobalSettingsTab = 'users' | 'backup' | 'scheduler';

export interface GlobalSettingsToolbarAction {
  value: GlobalSettingsTab;
  label: string;
  color?: MantineColor;
}

export interface GlobalSettingsTabState {
  activeTab: GlobalSettingsTab;
  setActiveTab: (tab: GlobalSettingsTab) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  actions: GlobalSettingsToolbarAction[];
}
