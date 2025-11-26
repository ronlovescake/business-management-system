import React from 'react';
import { StatsCardGrid, type StatCard } from '@/components/ui';
import {
  IconCurrencyPeso,
  IconTrendingUp,
  IconTrendingDown,
} from '@tabler/icons-react';
import type { PriceStats } from '../types/price.types';

interface PriceStatsCardsProps {
  stats: PriceStats;
}

/**
 * Display price statistics cards
 */
export function PriceStatsCards({ stats }: PriceStatsCardsProps) {
  const cards = React.useMemo<StatCard[]>(
    () => [
      {
        title: 'Total Products',
        value: stats.total,
        icon: <IconCurrencyPeso size={20} stroke={1.6} />,
        color: 'blue',
        backgroundColor: 'var(--mantine-color-blue-6)',
      },
      {
        title: 'Average Price',
        value: `₱${stats.avgPrice.toLocaleString()}`,
        icon: <IconTrendingUp size={20} stroke={1.6} />,
        color: 'green',
        backgroundColor: 'var(--mantine-color-green-6)',
      },
      {
        title: 'Price Increases',
        value: stats.priceIncreases,
        icon: <IconTrendingUp size={20} stroke={1.6} />,
        color: 'orange',
        backgroundColor: 'var(--mantine-color-orange-6)',
      },
      {
        title: 'Price Decreases',
        value: stats.priceDecreases,
        icon: <IconTrendingDown size={20} stroke={1.6} />,
        color: 'red',
        backgroundColor: 'var(--mantine-color-red-6)',
      },
    ],
    [stats]
  );

  return (
    <StatsCardGrid
      cards={cards}
      variant="vibrant"
      minCardWidth={220}
      spacing="md"
    />
  );
}
