import {
  Card,
  Center,
  Group,
  RingProgress,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconClock,
  IconPackage,
  IconReceipt,
  IconTruck,
} from '@tabler/icons-react';
import { FormatterService } from '@/services/FormatterService';
import type { MonthlyGoal, TodayActivity } from '../../types/dashboard.types';
import type { ReactNode } from 'react';

interface SidebarHighlightsProps {
  monthlyGoal?: MonthlyGoal | null;
  todayActivity?: TodayActivity | null;
}

export function SidebarHighlights({
  monthlyGoal,
  todayActivity,
}: SidebarHighlightsProps) {
  if (!monthlyGoal && !todayActivity) {
    return null;
  }

  return (
    <Stack gap="md">
      {monthlyGoal && (
        <Card
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          className="modern-card"
        >
          <Stack gap="md" align="center">
            <Title order={4}>Monthly Goal</Title>
            <RingProgress
              size={120}
              thickness={10}
              sections={[{ value: monthlyGoal.percentage, color: 'pink' }]}
              label={
                <Center>
                  <Text size="xl" fw={700}>
                    {monthlyGoal.percentage}%
                  </Text>
                </Center>
              }
            />
            <Stack gap={0} align="center">
              <Text size="sm" c="dimmed">
                Target {FormatterService.formatCurrency(monthlyGoal.target)}
              </Text>
              <Text size="sm" c="pink" fw={600}>
                {FormatterService.formatCurrency(monthlyGoal.current)} hit
              </Text>
            </Stack>
          </Stack>
        </Card>
      )}
      {todayActivity && (
        <Card
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          className="modern-card"
        >
          <Stack gap="sm">
            <Group justify="space-between">
              <Title order={4}>Today&apos;s Activity</Title>
              <ThemeIcon size="sm" variant="light" color="blue" radius="sm">
                <IconClock size={14} />
              </ThemeIcon>
            </Group>
            <QuickMetric
              label="New Orders"
              value={`+${todayActivity.newOrders}`}
              icon={<IconReceipt size={16} />}
              color="green"
            />
            <QuickMetric
              label="Pending Shipments"
              value={`${todayActivity.pendingShipments} routes`}
              icon={<IconTruck size={16} />}
              color="blue"
            />
            <QuickMetric
              label="Low Stock Alerts"
              value={`${todayActivity.lowStockItems} items`}
              icon={<IconPackage size={16} />}
              color="orange"
            />
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

interface QuickMetricProps {
  label: string;
  value: string;
  icon: ReactNode;
  color: string;
}

function QuickMetric({ label, value, icon, color }: QuickMetricProps) {
  return (
    <Group justify="space-between">
      <Group gap="sm">
        <ThemeIcon size="sm" radius="sm" variant="light" color={color}>
          {icon}
        </ThemeIcon>
        <Text size="sm">{label}</Text>
      </Group>
      <Text size="xs" c="dimmed">
        {value}
      </Text>
    </Group>
  );
}
