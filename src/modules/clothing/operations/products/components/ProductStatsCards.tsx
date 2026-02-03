'use client';

/**
 * Product Statistics Cards Component
 * Displays 4 key metrics: Total Products, Total Value, Average Value, Total Profit
 */

import React from 'react';
import { StatsCardGrid, type StatCard } from '@/components/ui';
import {
  IconCurrencyPeso,
  IconTrendingUp,
  IconAdjustments,
} from '@tabler/icons-react';
import { formatNumber } from '@/lib/formatters';
import type { ProductStatistics } from '../types/product.types';

interface ProductStatsCardsProps {
  statistics: ProductStatistics;
}

export function ProductStatsCards({ statistics }: ProductStatsCardsProps) {
  const cards = React.useMemo<StatCard[]>(
    () => [
      {
        title: 'Total Products',
        value: statistics.total,
        icon: <IconCurrencyPeso size={20} stroke={1.6} />,
        color: 'blue',
        backgroundColor: 'var(--mantine-color-blue-6)',
      },
      {
        title: 'Total Value',
        value: `₱${formatNumber(statistics.totalValue)}`,
        icon: <IconTrendingUp size={20} stroke={1.6} />,
        color: 'green',
        backgroundColor: 'var(--mantine-color-green-6)',
      },
      {
        title: 'Average Value',
        value: `₱${formatNumber(statistics.avgValue)}`,
        icon: <IconAdjustments size={20} stroke={1.6} />,
        color: 'orange',
        backgroundColor: '#fd7e14',
      },
      {
        title: 'Total Profit',
        value: `₱${formatNumber(statistics.totalProfit)}`,
        icon: <IconTrendingUp size={20} stroke={1.6} />,
        color: 'purple',
        backgroundColor: '#9775fa',
      },
    ],
    [statistics]
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
