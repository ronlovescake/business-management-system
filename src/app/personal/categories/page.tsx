'use client';

import { Card, List, Stack, Text } from '@mantine/core';
import { PersonalPageShell } from '../components/PersonalPageShell';

export default function PersonalCategoriesPage() {
  return (
    <PersonalPageShell
      title="Categories"
      description="Define expense and income categories for household tracking."
    >
      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Text fw={600}>Planned capabilities</Text>
          <List spacing={6} size="sm">
            <List.Item>
              Custom category groups (home, food, transport, etc.)
            </List.Item>
            <List.Item>Income and expense category separation</List.Item>
            <List.Item>Color coding for quick visual cues</List.Item>
            <List.Item>Archive or merge categories safely</List.Item>
          </List>
          <Text size="sm" c="dimmed">
            This page is scaffolded and ready for data integration.
          </Text>
        </Stack>
      </Card>
    </PersonalPageShell>
  );
}
