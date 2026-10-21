'use client';

import React from 'react';
import { StatsCardGrid, type StatCard } from '@/components/ui';
import {
  IconUsers,
  IconFilter,
  IconBuildingStore,
  IconPhone,
} from '@tabler/icons-react';
import type { CustomerStats } from '../types/customer.types';

interface CustomerStatsCardsProps {
  stats: CustomerStats;
  subtle?: boolean;
}

/**
 * Customer Statistics Cards Component
 * Displays 4 stat cards: Total, Filtered, Unique Businesses, Contactable
 */
export function CustomerStatsCards({
  stats,
  subtle = false,
}: CustomerStatsCardsProps) {
  const cards = React.useMemo<StatCard[]>(
    () => [
      {
        title: 'Total customers',
        value: stats.total,
        icon: <IconUsers size={20} stroke={1.6} />,
        color: 'blue',
        backgroundColor: 'var(--mantine-color-blue-6)',
      },
      {
        title: 'In current view',
        value: stats.filtered,
        icon: <IconFilter size={20} stroke={1.6} />,
        color: subtle ? 'gray' : 'grape',
        backgroundColor: 'var(--mantine-color-grape-6)',
      },
      {
        title: 'Unique businesses',
        value: stats.uniqueBusinesses,
        icon: <IconBuildingStore size={20} stroke={1.6} />,
        color: 'teal',
        backgroundColor: 'var(--mantine-color-teal-6)',
      },
      {
        title: 'Contactable',
        value: `${stats.contactable} (${stats.contactablePct}%)`,
        icon: <IconPhone size={20} stroke={1.6} />,
        color: 'green',
        backgroundColor: 'var(--mantine-color-green-6)',
      },
    ],
    [stats, subtle]
  );

  return (
    <StatsCardGrid
      cards={
        subtle
          ? cards.map((card) => ({ ...card, backgroundColor: undefined }))
          : cards
      }
      variant={subtle ? 'subtle' : 'vibrant'}
      radius={8}
      minCardWidth={subtle ? 200 : 220}
      spacing="md"
    />
  );
}
