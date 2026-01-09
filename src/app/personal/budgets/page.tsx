'use client';

import { Card, List, Stack, Text } from '@mantine/core';
import { PersonalPageShell } from '../components/PersonalPageShell';

export default function PersonalBudgetsPage() {
  return (
    <PersonalPageShell
      title="Budgets"
      description="Plan monthly and annual budgets across categories and accounts."
    >
      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Text fw={600}>Planned capabilities</Text>
          <List spacing={6} size="sm">
            <List.Item>Envelope or category-based budgeting</List.Item>
            <List.Item>Monthly vs yearly budget views</List.Item>
            <List.Item>Variance tracking and alerts</List.Item>
            <List.Item>Rollovers for unspent amounts</List.Item>
          </List>
          <Text size="sm" c="dimmed">
            This page is scaffolded and ready for data integration.
          </Text>
        </Stack>
      </Card>
    </PersonalPageShell>
  );
}
