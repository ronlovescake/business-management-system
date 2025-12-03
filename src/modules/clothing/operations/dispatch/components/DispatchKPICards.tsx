'use client';

import { memo } from 'react';
import { Card, Text, Group, SimpleGrid } from '@mantine/core';
import {
  IconUsers,
  IconCheck,
  IconAlertCircle,
  IconChartBar,
} from '@tabler/icons-react';

interface DispatchKPICardsProps {
  totalOrders: number;
  filteredCount: number;
  completedCount: number;
  stats: {
    totalUnmatchedOrders: number;
    ordersWithPossibleMatches: number;
    ordersWithoutMatches: number;
    totalPossibleMatches: number;
    averageMatchesPerOrder: number;
  };
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  description?: string;
}

const StatCard = memo(function StatCard({
  title,
  value,
  icon,
  color,
  description,
}: StatCardProps) {
  return (
    <Card withBorder padding="md">
      <Group justify="space-between" mb="xs">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
          {title}
        </Text>
        <div style={{ color: `var(--mantine-color-${color}-6)` }}>{icon}</div>
      </Group>
      <Text size="xl" fw={700} c={color}>
        {value}
      </Text>
      {description && (
        <Text size="xs" c="dimmed" mt={4}>
          {description}
        </Text>
      )}
    </Card>
  );
});

function DispatchKPICardsComponent({
  totalOrders,
  filteredCount,
  completedCount,
  stats,
}: DispatchKPICardsProps) {
  return (
    <SimpleGrid
      cols={{ base: 1, xs: 2, sm: 3, md: 4, lg: 6 }}
      spacing="md"
      mb="md"
    >
      <StatCard
        title="Total Orders"
        value={totalOrders}
        icon={<IconUsers size={20} />}
        color="blue"
        description="All imported orders"
      />
      <StatCard
        title="Filtered"
        value={filteredCount}
        icon={<IconChartBar size={20} />}
        color="cyan"
        description="Currently displayed"
      />
      <StatCard
        title="Completed"
        value={completedCount}
        icon={<IconCheck size={20} />}
        color="green"
        description="Orders handled"
      />
      <StatCard
        title="Unmatched"
        value={stats.totalUnmatchedOrders}
        icon={<IconAlertCircle size={20} />}
        color="orange"
        description="Need customer match"
      />
      <StatCard
        title="With Matches"
        value={stats.ordersWithPossibleMatches}
        icon={<IconUsers size={20} />}
        color="teal"
        description="Have possible matches"
      />
      <StatCard
        title="Avg Matches"
        value={stats.averageMatchesPerOrder}
        icon={<IconChartBar size={20} />}
        color="violet"
        description="Per unmatched order"
      />
    </SimpleGrid>
  );
}

export const DispatchKPICards = memo(DispatchKPICardsComponent);
DispatchKPICards.displayName = 'DispatchKPICards';
