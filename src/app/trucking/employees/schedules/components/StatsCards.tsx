import { memo, useMemo } from 'react';
import {
  IconCalendarEvent,
  IconCheck,
  IconClock,
  IconX,
} from '@tabler/icons-react';

import { StatsCardGrid, type StatCard } from '@/components/ui';

interface StatsCardsProps {
  totalSchedules: number;
  scheduledCount: number;
  completedCount: number;
  cancelledCount: number;
}

const buildStatsCards = ({
  totalSchedules,
  scheduledCount,
  completedCount,
  cancelledCount,
}: StatsCardsProps): StatCard[] => [
  {
    title: 'Total Schedules',
    value: totalSchedules,
    icon: <IconCalendarEvent size={18} />,
    color: 'blue',
    backgroundColor: 'var(--mantine-color-blue-6)',
  },
  {
    title: 'Scheduled',
    value: scheduledCount,
    icon: <IconClock size={18} />,
    color: 'cyan',
    backgroundColor: 'var(--mantine-color-cyan-6)',
  },
  {
    title: 'Completed',
    value: completedCount,
    icon: <IconCheck size={18} />,
    color: 'green',
    backgroundColor: 'var(--mantine-color-green-6)',
  },
  {
    title: 'Cancelled',
    value: cancelledCount,
    icon: <IconX size={18} />,
    color: 'red',
    backgroundColor: 'var(--mantine-color-red-6)',
  },
];

/**
 * StatsCards Component
 *
 * Shows overview statistics for schedules
 */
export const StatsCards = memo(function StatsCards(props: StatsCardsProps) {
  const { totalSchedules, scheduledCount, completedCount, cancelledCount } =
    props;

  const cards = useMemo(
    () =>
      buildStatsCards({
        totalSchedules,
        scheduledCount,
        completedCount,
        cancelledCount,
      }),
    [totalSchedules, scheduledCount, completedCount, cancelledCount]
  );

  return (
    <StatsCardGrid
      cards={cards}
      spacing="md"
      radius="md"
      variant="vibrant"
      minCardWidth={220}
    />
  );
});
