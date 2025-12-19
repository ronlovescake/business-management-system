'use client';

import { UserManagementSection } from '@/components/settings/UserManagementSection';
import type { GlobalSettingsTab } from '../types/global-settings.types';
import { BackupRestorePlaceholder } from './BackupRestorePlaceholder';
import { BackupSchedulerTab } from './BackupSchedulerTab';

interface SettingsTabContentProps {
  activeTab: GlobalSettingsTab;
}

export function SettingsTabContent({ activeTab }: SettingsTabContentProps) {
  if (activeTab === 'backup') {
    return <BackupRestorePlaceholder />;
  }

  if (activeTab === 'scheduler') {
    return <BackupSchedulerTab />;
  }

  return <UserManagementSection />;
}
