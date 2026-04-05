import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  GlobalSettingsTab,
  GlobalSettingsTabState,
  GlobalSettingsToolbarAction,
} from '../types/global-settings.types';

const VALID_TABS: readonly GlobalSettingsTab[] = [
  'users',
  'payments',
  'backup',
  'scheduler',
];

const DEFAULT_ACTIONS: GlobalSettingsToolbarAction[] = [
  { value: 'users', label: 'User Management' },
  { value: 'payments', label: 'Payments & Cards', color: 'teal' },
  { value: 'backup', label: 'Backup & Restore', color: 'grape' },
  { value: 'scheduler', label: 'Schedulers', color: 'indigo' },
];

export function useGlobalSettingsTabs(
  initialTab: GlobalSettingsTab = 'users'
): GlobalSettingsTabState {
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get('tab') as GlobalSettingsTab | null;
  const resolvedInitialTab =
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : initialTab;
  const [activeTab, setActiveTab] =
    useState<GlobalSettingsTab>(resolvedInitialTab);
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
