'use client';

import { Card, SimpleGrid, Stack, Text } from '@mantine/core';
import { PersonalPageShell } from '../components/PersonalPageShell';

export default function PersonalDashboardPage() {
  const placeholders = [
    { title: 'Net worth', value: 'Add accounts to calculate' },
    { title: 'Monthly cash flow', value: 'Track income and expenses' },
    { title: 'Budget status', value: 'Create budgets to monitor' },
    { title: 'Upcoming bills', value: 'Add due dates to stay ahead' },
  ];

  return (
    <PersonalPageShell
      title="Personal Dashboard"
      description="Overview of household finances, cash flow, and budgets."
    >
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        {placeholders.map((item) => (
          <Card key={item.title} withBorder padding="md" radius="md">
            <Stack gap={6}>
              <Text fw={600}>{item.title}</Text>
              <Text size="sm" c="dimmed">
                {item.value}
              </Text>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </PersonalPageShell>
  );
}
