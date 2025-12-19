'use client';

import PageLayout from '@/components/layout/PageLayout';
import { GlobalSettingsPage } from '@/modules/settings/global';

export function SettingsPageClient() {
  return (
    <PageLayout title="Global Settings" size="xl" fluid>
      <GlobalSettingsPage />
    </PageLayout>
  );
}
