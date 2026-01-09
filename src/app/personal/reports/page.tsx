'use client';

import { Card, List, Stack, Text } from '@mantine/core';
import { PersonalPageShell } from '../components/PersonalPageShell';

export default function PersonalReportsPage() {
  return (
    <PersonalPageShell
      title="Reports"
      description="Analyze spending, income trends, and cash flow for the household."
    >
      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Text fw={600}>Planned reports</Text>
          <List spacing={6} size="sm">
            <List.Item>Cash flow statement by month</List.Item>
            <List.Item>Spending by category and merchant</List.Item>
            <List.Item>Income vs expense trend lines</List.Item>
            <List.Item>Net worth progression over time</List.Item>
          </List>
          <Text size="sm" c="dimmed">
            This page is scaffolded and ready for data integration.
          </Text>
        </Stack>
      </Card>
    </PersonalPageShell>
  );
}
