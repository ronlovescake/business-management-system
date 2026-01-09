'use client';

import { Card, List, Stack, Text } from '@mantine/core';
import { PersonalPageShell } from '../components/PersonalPageShell';

export default function PersonalIncomePage() {
  return (
    <PersonalPageShell
      title="Personal Income"
      description="Track salaries, freelance work, dividends, and other income streams."
    >
      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Text fw={600}>Planned capabilities</Text>
          <List spacing={6} size="sm">
            <List.Item>Schedule recurring income deposits</List.Item>
            <List.Item>Map income to accounts for net worth tracking</List.Item>
            <List.Item>Tag income sources for reporting</List.Item>
            <List.Item>Track withholding and deductions</List.Item>
          </List>
          <Text size="sm" c="dimmed">
            This page is scaffolded and ready for data integration.
          </Text>
        </Stack>
      </Card>
    </PersonalPageShell>
  );
}
