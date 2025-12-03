import {
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import type { DashboardStatistic } from '../../types/dashboard.types';

interface DashboardStatisticsGridProps {
  statistics: DashboardStatistic[];
}

export function DashboardStatisticsGrid({
  statistics,
}: DashboardStatisticsGridProps) {
  if (!statistics.length) {
    return null;
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
      {statistics.map((stat) => (
        <Card
          key={stat.title}
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          className="modern-card"
        >
          <Group justify="space-between">
            <Stack gap="xs">
              <Text size="sm" c="dimmed" fw={500}>
                {stat.title}
              </Text>
              <Text size="xl" fw={700}>
                {stat.value}
              </Text>
              <Badge size="sm" variant="light" color={stat.color}>
                {stat.change}
              </Badge>
            </Stack>
            <ThemeIcon size="xl" radius="md" variant="light" color={stat.color}>
              <stat.icon size={24} />
            </ThemeIcon>
          </Group>
        </Card>
      ))}
    </SimpleGrid>
  );
}
