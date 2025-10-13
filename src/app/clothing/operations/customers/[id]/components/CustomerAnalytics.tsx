import { Card, Stack, Title, SimpleGrid, Text, Group } from '@mantine/core';
import type { CustomerStats } from '../types';
import { formatCurrency, getRateColor } from '../utils';

// ============================================================================
// CUSTOMER ANALYTICS CARD
// ============================================================================

interface CustomerAnalyticsProps {
  stats: CustomerStats;
}

export function CustomerAnalytics({ stats }: CustomerAnalyticsProps) {
  const customerValue =
    stats.totalSpent >= 10000
      ? 'High'
      : stats.totalSpent >= 5000
        ? 'Medium'
        : 'Standard';

  const customerValueColor =
    stats.totalSpent >= 10000
      ? 'green'
      : stats.totalSpent >= 5000
        ? 'yellow'
        : 'gray';

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        <Title order={4}>Customer Analytics</Title>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {/* Order Status Breakdown */}
          <Stack gap="xs">
            <Text size="sm" fw={500} c="dimmed">
              Order Status Breakdown
            </Text>
            <Stack gap={4}>
              <Group justify="space-between">
                <Group gap="xs">
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'var(--mantine-color-green-6)',
                    }}
                  />
                  <Text size="xs">Completed</Text>
                </Group>
                <Text size="xs" fw={500}>
                  {stats.completedOrders}
                </Text>
              </Group>
              <Group justify="space-between">
                <Group gap="xs">
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'var(--mantine-color-blue-6)',
                    }}
                  />
                  <Text size="xs">Processing</Text>
                </Group>
                <Text size="xs" fw={500}>
                  {stats.processingOrders}
                </Text>
              </Group>
              <Group justify="space-between">
                <Group gap="xs">
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'var(--mantine-color-red-6)',
                    }}
                  />
                  <Text size="xs">Cancelled</Text>
                </Group>
                <Text size="xs" fw={500}>
                  {stats.cancelledOrders}
                </Text>
              </Group>
            </Stack>
          </Stack>

          {/* Performance Metrics */}
          <Stack gap="xs">
            <Text size="sm" fw={500} c="dimmed">
              Performance Metrics
            </Text>
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="xs">Success Rate</Text>
                <Text size="xs" fw={500} c={getRateColor(stats.completionRate)}>
                  {stats.completionRate}%
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="xs">Failure Rate</Text>
                <Text
                  size="xs"
                  fw={500}
                  c={getRateColor(stats.cancellationRate, true)}
                >
                  {stats.cancellationRate}%
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="xs">Recent Activity</Text>
                <Text size="xs" fw={500}>
                  {stats.recentTransactions} transactions (30d)
                </Text>
              </Group>
            </Stack>
          </Stack>

          {/* Financial Summary */}
          <Stack gap="xs">
            <Text size="sm" fw={500} c="dimmed">
              Financial Summary
            </Text>
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="xs">Total Revenue</Text>
                <Text size="xs" fw={500}>
                  {formatCurrency(stats.totalSpent)}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="xs">Avg Transaction Value</Text>
                <Text size="xs" fw={500}>
                  {formatCurrency(stats.averageTransactionValue)}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="xs">Customer Value</Text>
                <Text size="xs" fw={500} c={customerValueColor}>
                  {customerValue}
                </Text>
              </Group>
            </Stack>
          </Stack>

          {/* Quick Stats */}
          <Stack gap="xs">
            <Text size="sm" fw={500} c="dimmed">
              Quick Stats
            </Text>
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="xs">Total Orders</Text>
                <Text size="xs" fw={500}>
                  {stats.totalOrders}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="xs">Total Transactions</Text>
                <Text size="xs" fw={500}>
                  {stats.totalTransactions}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="xs">Completion Rate</Text>
                <Text size="xs" fw={500} c="green">
                  {stats.completionRate}%
                </Text>
              </Group>
            </Stack>
          </Stack>
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
