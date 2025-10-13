import { Card, Group, Text, Title, ThemeIcon, SimpleGrid } from '@mantine/core';
import { IconReceipt, IconCheck, IconX } from '@tabler/icons-react';
import type { CustomerStats } from '../types';
import { formatCurrency } from '../utils';

// ============================================================================
// CUSTOMER STATS CARDS
// ============================================================================

interface CustomerStatsCardsProps {
  stats: CustomerStats;
}

export function CustomerStatsCards({ stats }: CustomerStatsCardsProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
      {/* Total Transactions Card */}
      <Card
        shadow="sm"
        padding="md"
        radius="md"
        style={{
          background: 'var(--mantine-color-blue-6)',
          color: 'white',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Text c="white" size="xs" style={{ opacity: 0.85 }}>
              Total Transactions
            </Text>
            <Title order={3} c="white">
              {stats.totalTransactions}
            </Title>
            <Text c="white" size="xs" style={{ opacity: 0.7 }}>
              {stats.recentTransactions} in last 30 days
            </Text>
          </div>
          <ThemeIcon variant="white" color="blue" size="lg" radius="md">
            <IconReceipt size={18} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* Completion Rate Card */}
      <Card
        shadow="sm"
        padding="md"
        radius="md"
        style={{
          background: 'var(--mantine-color-green-6)',
          color: 'white',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Text c="white" size="xs" style={{ opacity: 0.85 }}>
              Completion Rate
            </Text>
            <Title order={3} c="white">
              {stats.completionRate}%
            </Title>
            <Text c="white" size="xs" style={{ opacity: 0.7 }}>
              {stats.completedOrders} completed
            </Text>
          </div>
          <ThemeIcon variant="white" color="green" size="lg" radius="md">
            <IconCheck size={18} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* Cancellation Rate Card */}
      <Card
        shadow="sm"
        padding="md"
        radius="md"
        style={{ background: 'var(--mantine-color-red-6)', color: 'white' }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Text c="white" size="xs" style={{ opacity: 0.85 }}>
              Cancellation Rate
            </Text>
            <Title order={3} c="white">
              {stats.cancellationRate}%
            </Title>
            <Text c="white" size="xs" style={{ opacity: 0.7 }}>
              {stats.cancelledOrders} cancelled
            </Text>
          </div>
          <ThemeIcon variant="white" color="red" size="lg" radius="md">
            <IconX size={18} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* Average Transaction Value Card */}
      <Card
        shadow="sm"
        padding="md"
        radius="md"
        style={{
          background: 'var(--mantine-color-yellow-6)',
          color: 'white',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Text c="white" size="xs" style={{ opacity: 0.85 }}>
              Avg Transaction Value
            </Text>
            <Title order={3} c="white">
              {formatCurrency(stats.averageTransactionValue)}
            </Title>
            <Text c="white" size="xs" style={{ opacity: 0.7 }}>
              From {stats.completedTransactions} completed
            </Text>
          </div>
          <ThemeIcon variant="white" color="yellow" size="lg" radius="md">
            <IconReceipt size={18} />
          </ThemeIcon>
        </Group>
      </Card>
    </SimpleGrid>
  );
}
