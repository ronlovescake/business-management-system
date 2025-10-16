import React from 'react';
import { StatsCardGroup } from '@/components/shared/PageTemplates';
import type { StatCard } from '@/components/shared/PageTemplates';
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

export function StatsCards({
  totalRequests,
  pendingRequests,
  approvedRequests,
  totalDaysRequested,
}: StatsCardsProps) {
  const stats: StatCard[] = [
    {
      title: 'Total Requests',
      value: totalRequests.toString(),
      icon: <IconCalendarEvent size={32} stroke={1.5} />,
    },
    {
      title: 'Pending',
      value: pendingRequests.toString(),
      icon: <IconClock size={32} stroke={1.5} />,
    },
    {
      title: 'Approved',
      value: approvedRequests.toString(),
      icon: <IconCheck size={32} stroke={1.5} />,
    },
    {
      title: 'Total Days',
      value: totalDaysRequested.toString(),
      icon: <IconCalendarStats size={32} stroke={1.5} />,
    },
  ];

  return <StatsCardGroup stats={stats} />;
}
