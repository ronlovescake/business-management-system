import React from 'react';
import { StatsCardGrid, type StatCard } from '@/components/ui';
import {
  IconCalendarEvent,
  IconClock,
  IconCheck,
  IconCalendarStats,
} from '@tabler/icons-react';

interface StatsCardsProps {
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  totalDaysRequested: number;
}

export const StatsCards = React.memo(function StatsCards({
  totalRequests,
  pendingRequests,
  approvedRequests,
  totalDaysRequested,
}: StatsCardsProps) {
  const stats: StatCard[] = React.useMemo(
    () => [
      {
        title: 'Total Requests',
        value: totalRequests,
        icon: <IconCalendarEvent size={20} stroke={1.6} />,
        color: 'blue',
        backgroundColor: 'var(--mantine-color-blue-6)',
      },
      {
        title: 'Pending',
        value: pendingRequests,
        icon: <IconClock size={20} stroke={1.6} />,
        color: 'orange',
        backgroundColor: 'var(--mantine-color-orange-6)',
      },
      {
        title: 'Approved',
        value: approvedRequests,
        icon: <IconCheck size={20} stroke={1.6} />,
        color: 'green',
        backgroundColor: 'var(--mantine-color-green-6)',
      },
      {
        title: 'Total Days',
        value: totalDaysRequested,
        icon: <IconCalendarStats size={20} stroke={1.6} />,
        color: 'teal',
        backgroundColor: 'var(--mantine-color-teal-6)',
      },
    ],
    [approvedRequests, pendingRequests, totalDaysRequested, totalRequests]
  );

  return (
    <StatsCardGrid
      cards={stats}
      variant="vibrant"
      minCardWidth={220}
      spacing="md"
    />
  );
});
