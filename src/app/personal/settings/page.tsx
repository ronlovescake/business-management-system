'use client';

import { Card, List, Stack, Text } from '@mantine/core';
import { PersonalPageShell } from '../components/PersonalPageShell';

export default function PersonalSettingsPage() {
  return (
    <PersonalPageShell
      title="Personal Settings"
      description="Configure preferences for personal and household finance."
    >
      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Text fw={600}>Planned controls</Text>
          <List spacing={6} size="sm">
            <List.Item>Currency and locale preferences</List.Item>
            <List.Item>Default accounts and categories</List.Item>
            <List.Item>Backup and export settings</List.Item>
            <List.Item>Notification preferences</List.Item>
          </List>
          <Text size="sm" c="dimmed">
            This page is scaffolded and ready for data integration.
          </Text>
        </Stack>
      </Card>
    </PersonalPageShell>
  );
}
