import { memo, useMemo } from 'react';
import {
  IconTruckDelivery,
  IconCalendarStats,
  IconClockHour3,
  IconChecks,
} from '@tabler/icons-react';
import { StatsCardGrid, type StatCard } from '@/components/ui';

interface TruckAssignmentsStatsCardsProps {
  activeCount: number;
  scheduledThisWeek: number;
  endingSoon: number;
  completedThisMonth: number;
}

export const TruckAssignmentsStatsCards = memo(
  function TruckAssignmentsStatsCards({
    activeCount,
    scheduledThisWeek,
    endingSoon,
    completedThisMonth,
  }: TruckAssignmentsStatsCardsProps) {
    const cards: StatCard[] = useMemo(
      () => [
        {
          title: 'Active Assignments',
          value: activeCount.toString(),
          icon: <IconTruckDelivery size={24} stroke={1.6} />,
          color: 'green',
          backgroundColor:
            'linear-gradient(135deg, rgba(34,197,94,0.95), rgba(16,185,129,0.95))',
        },
        {
          title: 'Scheduled (Next 7d)',
          value: scheduledThisWeek.toString(),
          icon: <IconCalendarStats size={24} stroke={1.6} />,
          color: 'blue',
          backgroundColor:
            'linear-gradient(135deg, rgba(37,99,235,0.95), rgba(59,130,246,0.95))',
        },
        {
          title: 'Ending Soon (7d)',
          value: endingSoon.toString(),
          icon: <IconClockHour3 size={24} stroke={1.6} />,
          color: 'orange',
          backgroundColor:
            'linear-gradient(135deg, rgba(249,115,22,0.95), rgba(234,88,12,0.95))',
        },
        {
          title: 'Completed This Month',
          value: completedThisMonth.toString(),
          icon: <IconChecks size={24} stroke={1.6} />,
          color: 'teal',
          backgroundColor:
            'linear-gradient(135deg, rgba(13,148,136,0.95), rgba(20,184,166,0.95))',
        },
      ],
      [activeCount, completedThisMonth, endingSoon, scheduledThisWeek]
    );

    return (
      <StatsCardGrid
        cards={cards}
        variant="vibrant"
        minCardWidth={240}
        spacing="md"
      />
    );
  }
);
