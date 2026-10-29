'use client';

/**
 * Product Statistics Cards Component
 * Displays 4 key metrics: Total Products, Total Value, Average Value, Total Profit
 */

import React, { memo } from 'react';
import { Card, Group, Text, ThemeIcon, Title } from '@mantine/core';
import {
  IconBox,
  IconPackage,
  IconReceipt,
  IconScale,
  IconTrendingUp,
  IconTruck,
  IconAdjustments,
} from '@tabler/icons-react';
import { formatNumber } from '@/lib/formatters';
import type { ProductStatistics } from '../types/product.types';

interface ProductStatCard {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  backgroundColor: string;
  currency?: boolean;
}

interface ProductStatsCardsProps {
  statistics: ProductStatistics;
}

export const ProductStatsCards = memo(function ProductStatsCards({
  statistics,
}: ProductStatsCardsProps) {
  const cards: ProductStatCard[] = [
    {
      title: 'Total Products',
      value: statistics.total,
      icon: <IconPackage size={20} stroke={1.6} />,
      color: 'blue',
      backgroundColor: 'var(--mantine-color-blue-6)',
    },
    {
      title: 'Grand Total',
      value: statistics.grandTotal,
      icon: <IconReceipt size={20} stroke={1.6} />,
      color: 'green',
      backgroundColor: 'var(--mantine-color-green-6)',
      currency: true,
    },
    {
      title: 'Projected Sales',
      value: statistics.totalValue,
      icon: <IconTrendingUp size={20} stroke={1.6} />,
      color: 'cyan',
      backgroundColor: 'var(--mantine-color-cyan-7)',
      currency: true,
    },
    {
      title: 'Projected Profit',
      value: statistics.totalProfit,
      icon: <IconTrendingUp size={20} stroke={1.6} />,
      color: 'teal',
      backgroundColor: 'var(--mantine-color-teal-7)',
      currency: true,
    },
    {
      title: 'COGS',
      value: statistics.cogs,
      icon: <IconScale size={20} stroke={1.6} />,
      color: 'orange',
      backgroundColor: 'var(--mantine-color-orange-6)',
      currency: true,
    },
    {
      title: "Forwarder's Fee",
      value: statistics.forwardersFee,
      icon: <IconTruck size={20} stroke={1.6} />,
      color: 'indigo',
      backgroundColor: 'var(--mantine-color-indigo-6)',
      currency: true,
    },
    {
      title: 'Lalamove',
      value: statistics.lalamove,
      icon: <IconTruck size={20} stroke={1.6} />,
      color: 'red',
      backgroundColor: 'var(--mantine-color-red-6)',
      currency: true,
    },
    {
      title: 'Packaging Cost',
      value: statistics.packagingCost,
      icon: <IconBox size={20} stroke={1.6} />,
      color: 'gray',
      backgroundColor: 'var(--mantine-color-gray-7)',
      currency: true,
    },
    {
      title: 'Total Quantity',
      value: statistics.totalQuantity,
      icon: <IconBox size={20} stroke={1.6} />,
      color: 'lime',
      backgroundColor: 'var(--mantine-color-lime-7)',
    },
    {
      title: 'Average Projected Sales',
      value: statistics.avgValue,
      icon: <IconAdjustments size={20} stroke={1.6} />,
      color: 'yellow',
      backgroundColor: 'var(--mantine-color-yellow-7)',
      currency: true,
    },
  ];

  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        paddingBottom: '0.25rem',
      }}
    >
      <div
        data-testid="product-stat-cards-row"
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          gap: 'var(--mantine-spacing-md)',
          width: '100%',
        }}
      >
        {cards.map((card) => (
          <Card
            key={card.title}
            shadow="sm"
            padding="md"
            radius="sm"
            style={{
              flex: '1 0 220px',
              minWidth: 220,
              minHeight: 96,
              background: card.backgroundColor,
              color: 'white',
            }}
          >
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <div style={{ minWidth: 0 }}>
                <Text c="white" size="xs" fw={600} style={{ opacity: 0.88 }}>
                  {card.title}
                </Text>
                <Title
                  order={4}
                  c="white"
                  mt="xs"
                  style={{ overflowWrap: 'anywhere' }}
                >
                  {card.currency ? '₱' : ''}
                  {formatNumber(card.value)}
                </Title>
              </div>
              <ThemeIcon
                variant="white"
                color={card.color}
                size="lg"
                radius="md"
              >
                {card.icon}
              </ThemeIcon>
            </Group>
          </Card>
        ))}
      </div>
    </div>
  );
});
