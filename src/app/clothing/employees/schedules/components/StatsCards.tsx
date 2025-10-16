import { SimpleGrid, Card, Text, Group } from '@mantine/core';
import {
  IconCalendarEvent,
  IconCheck,
  IconX,
  IconClock,
} from '@tabler/icons-react';

interface StatsCardsProps {
  totalSchedules: number;
  scheduledCount: number;
  completedCount: number;
  cancelledCount: number;
}

/**
 * StatsCards Component
 *
 * Shows overview statistics for schedules
 */
export function StatsCards({
  totalSchedules,
  scheduledCount,
  completedCount,
  cancelledCount,
}: StatsCardsProps) {
  const stats = [
    {
      label: 'Total Schedules',
      value: totalSchedules,
      icon: IconCalendarEvent,
      color: 'blue',
    },
    {
      label: 'Scheduled',
      value: scheduledCount,
      icon: IconClock,
      color: 'cyan',
    },
    {
      label: 'Completed',
      value: completedCount,
      icon: IconCheck,
      color: 'green',
    },
    {
      label: 'Cancelled',
      value: cancelledCount,
      icon: IconX,
      color: 'red',
    },
  ];

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          padding="lg"
          radius="xl"
          withBorder
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(15px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.2)',
            transition: 'all 0.3s ease',
          }}
        >
          <Group>
            <stat.icon
              size={32}
              color={`var(--mantine-color-${stat.color}-6)`}
            />
            <div>
              <Text
                size="xs"
                c="dimmed"
                style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {stat.label}
              </Text>
              <Text
                fw={700}
                size="xl"
                style={{
                  color: 'rgba(255, 255, 255, 0.95)',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                }}
              >
                {stat.value}
              </Text>
            </div>
          </Group>
        </Card>
      ))}
    </SimpleGrid>
  );
}
