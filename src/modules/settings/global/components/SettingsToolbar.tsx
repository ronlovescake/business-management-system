'use client';

import { Group, TextInput, Button } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type {
  GlobalSettingsToolbarAction,
  GlobalSettingsTab,
} from '../types/global-settings.types';

interface SettingsToolbarProps {
  activeTab: GlobalSettingsTab;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onTabChange: (tab: GlobalSettingsTab) => void;
  actions: GlobalSettingsToolbarAction[];
}

export function SettingsToolbar({
  activeTab,
  searchValue,
  onSearchChange,
  onTabChange,
  actions,
}: SettingsToolbarProps) {
  return (
    <Group gap="sm" wrap="wrap" align="center">
      <TextInput
        placeholder="Search settings"
        leftSection={<IconSearch size={16} />}
        flex={1}
        maw={600}
        value={searchValue}
        onChange={(event) => onSearchChange(event.currentTarget.value)}
      />

      <Group gap="sm" wrap="wrap">
        {actions.map((action) => (
          <Button
            key={action.value}
            variant={activeTab === action.value ? 'filled' : 'light'}
            color={action.color}
            onClick={() => onTabChange(action.value)}
            data-active={activeTab === action.value || undefined}
          >
            {action.label}
          </Button>
        ))}
      </Group>
    </Group>
  );
}
