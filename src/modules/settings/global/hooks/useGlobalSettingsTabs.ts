import { useCallback, useMemo, useState } from 'react';
import type {
  GlobalSettingsTab,
  GlobalSettingsTabState,
  GlobalSettingsToolbarAction,
} from '../types/global-settings.types';

const DEFAULT_ACTIONS: GlobalSettingsToolbarAction[] = [
  { value: 'users', label: 'User Management' },
  { value: 'backup', label: 'Backup & Restore', color: 'grape' },
  { value: 'scheduler', label: 'Schedulers', color: 'indigo' },
];

export function useGlobalSettingsTabs(
  initialTab: GlobalSettingsTab = 'users'
): GlobalSettingsTabState {
  const [activeTab, setActiveTab] = useState<GlobalSettingsTab>(initialTab);
  const [searchValue, setSearchValue] = useState('');

  const actions = useMemo(() => DEFAULT_ACTIONS, []);

  const onSearchChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  return {
    activeTab,
    setActiveTab,
    searchValue,
    onSearchChange,
    actions,
  };
}
