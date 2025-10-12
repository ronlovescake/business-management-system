'use client';

/**
 * SettingsPage Component
 *
 * Main settings page with tabs for marketplace, installed modules, updates, and dependencies
 */

import { useState } from 'react';
import { Container, Title, Tabs, Paper } from '@mantine/core';
import {
  IconBuildingStore,
  IconPackage,
  IconDownload,
  IconGitBranch,
} from '@tabler/icons-react';
import { MarketplaceTab } from './MarketplaceTab';
import { InstalledModulesTab } from './InstalledModulesTab';
import { UpdatesTab } from './UpdatesTab';
import { DependenciesTab } from './DependenciesTab';
import type { SettingsTab } from '../types';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('marketplace');

  return (
    <Container size="xl" py="xl">
      <Title order={1} mb="xl">
        Module Marketplace & Settings
      </Title>

      <Paper shadow="sm" p="md" radius="md">
        <Tabs
          value={activeTab}
          onChange={(value) => setActiveTab(value as SettingsTab)}
        >
          <Tabs.List>
            <Tabs.Tab
              value="marketplace"
              leftSection={<IconBuildingStore size={16} />}
            >
              Marketplace
            </Tabs.Tab>
            <Tabs.Tab value="installed" leftSection={<IconPackage size={16} />}>
              Installed Modules
            </Tabs.Tab>
            <Tabs.Tab value="updates" leftSection={<IconDownload size={16} />}>
              Updates
            </Tabs.Tab>
            <Tabs.Tab
              value="dependencies"
              leftSection={<IconGitBranch size={16} />}
            >
              Dependencies
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="marketplace" pt="md">
            <MarketplaceTab />
          </Tabs.Panel>

          <Tabs.Panel value="installed" pt="md">
            <InstalledModulesTab />
          </Tabs.Panel>

          <Tabs.Panel value="updates" pt="md">
            <UpdatesTab />
          </Tabs.Panel>

          <Tabs.Panel value="dependencies" pt="md">
            <DependenciesTab />
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Container>
  );
}
