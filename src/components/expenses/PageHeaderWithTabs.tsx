'use client';

import React from 'react';
import { Card, Stack, Title, Tabs } from '@mantine/core';

export interface TabConfig {
  value: string;
  label: string;
  icon?: React.ReactNode;
  panel: React.ReactNode;
}

interface PageHeaderWithTabsProps {
  title: string;
  tabs: TabConfig[];
  activeTab: string | null;
  onTabChange: (value: string | null) => void;
}

/**
 * Reusable Page Header with Tabs Component
 *
 * Standard header for pages with:
 * - Page title
 * - Tab navigation
 * - Content panels for each tab
 * - Bordered card container
 *
 * @param title - Page title
 * @param tabs - Array of tab configurations
 * @param activeTab - Currently active tab value
 * @param onTabChange - Tab change handler
 */
export function PageHeaderWithTabs({
  title,
  tabs,
  activeTab,
  onTabChange,
}: PageHeaderWithTabsProps) {
  return (
    <Card withBorder padding="md">
      <Stack gap="md">
        <Title order={3}>{title}</Title>

        <Tabs value={activeTab} onChange={onTabChange}>
          <Tabs.List>
            {tabs.map((tab) => (
              <Tabs.Tab
                key={tab.value}
                value={tab.value}
                leftSection={tab.icon}
              >
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {tabs.map((tab) => (
            <Tabs.Panel key={tab.value} value={tab.value} pt="md">
              {tab.panel}
            </Tabs.Panel>
          ))}
        </Tabs>
      </Stack>
    </Card>
  );
}
