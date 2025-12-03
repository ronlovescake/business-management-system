import { Badge, Group, Stack, Text } from '@mantine/core';
import { IconShirt } from '@tabler/icons-react';

export function DashboardHeader() {
  return (
    <Group justify="space-between" align="flex-start">
      <Stack gap={4}>
        <Text size="lg" fw={600}>
          Operations Control Center
        </Text>
        <Text c="dimmed" size="sm">
          Full view of revenue, fulfillment, and logistics performance.
        </Text>
      </Stack>
      <Badge size="lg" variant="light" color="pink">
        <Group gap="xs">
          <IconShirt size={14} />
          <Text>Clothing Operations</Text>
        </Group>
      </Badge>
    </Group>
  );
}
