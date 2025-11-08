'use client';

/**
 * SettingsPage Component
 *
 * Main settings page with tabs for marketplace, installed modules, updates, and dependencies
 */

import { useState } from 'react';
import { Container, Title, Tabs, Paper } from '@mantine/core';
import { IconDatabase } from '@tabler/icons-react';
import { BackupRestoreTab } from './BackupRestoreTab';
import type { SettingsTab } from '../types';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('backup');

  return (
    <Container size="xl" py="xl">
      <Title order={1} mb="xl">
        Settings
      </Title>

      <Paper shadow="sm" p="md" radius="md">
        <Tabs
          value={activeTab}
          onChange={(value) => setActiveTab(value as SettingsTab)}
        >
          <Tabs.List>
            <Tabs.Tab value="backup" leftSection={<IconDatabase size={16} />}>
              Backup & Restore
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="backup" pt="md">
            <BackupRestoreTab />
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Container>
  );
}
