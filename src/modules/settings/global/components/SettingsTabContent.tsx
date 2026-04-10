'use client';

import { UserManagementSection } from '@/components/settings/UserManagementSection';
import type { GlobalSettingsTab } from '../types/global-settings.types';
import { BackupRestoreTab } from '@/modules/clothing/operations/settings/components/BackupRestoreTab';
import { PitrWalTab } from './pitr/PitrWalTab';
import { SchedulerTab } from './scheduler/SchedulerTab';
import { PaymentCardsTab } from './payments/PaymentCardsTab';

interface SettingsTabContentProps {
  activeTab: GlobalSettingsTab;
}

export function SettingsTabContent({ activeTab }: SettingsTabContentProps) {
  if (activeTab === 'backup') {
    return <BackupRestoreTab />;
  }

  if (activeTab === 'pitr') {
    return <PitrWalTab />;
  }

  if (activeTab === 'scheduler') {
    return <SchedulerTab />;
  }

  if (activeTab === 'payments') {
    return <PaymentCardsTab />;
  }

  return <UserManagementSection />;
}
