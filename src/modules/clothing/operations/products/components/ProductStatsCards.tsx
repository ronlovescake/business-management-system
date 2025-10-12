'use client';

/**
 * Product Statistics Cards Component
 * Displays 4 key metrics: Total Products, Total Value, Average Value, Total Profit
 */

import { Card, Group, Text, Title, ThemeIcon, SimpleGrid } from '@mantine/core';
import {
  IconCurrencyDollar,
  IconTrendingUp,
  IconAdjustments,
} from '@tabler/icons-react';
import { ProductStatistics } from '../types/product.types';

interface ProductStatsCardsProps {
  statistics: ProductStatistics;
}

export function ProductStatsCards({ statistics }: ProductStatsCardsProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
      {/* Total Products Card */}
      <Card
        shadow="sm"
        padding="md"
        radius="md"
        style={{
          background: 'var(--mantine-color-blue-6)',
          color: 'white',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Text c="white" size="xs" style={{ opacity: 0.85 }}>
              Total Products
            </Text>
            <Title order={3} c="white">
              {statistics.total}
            </Title>
          </div>
          <ThemeIcon variant="white" color="blue" size="lg" radius="md">
            <IconCurrencyDollar size={18} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* Total Value Card */}
      <Card
        shadow="sm"
        padding="md"
        radius="md"
        style={{
          background: 'var(--mantine-color-green-6)',
          color: 'white',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Text c="white" size="xs" style={{ opacity: 0.85 }}>
              Total Value
            </Text>
            <Title order={3} c="white">
              ₱{statistics.totalValue.toLocaleString()}
            </Title>
          </div>
          <ThemeIcon variant="white" color="green" size="lg" radius="md">
            <IconTrendingUp size={18} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* Average Value Card */}
      <Card
        shadow="sm"
        padding="md"
        radius="md"
        style={{ background: '#fd7e14', color: 'white' }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Text c="white" size="xs" style={{ opacity: 0.85 }}>
              Average Value
            </Text>
            <Title order={3} c="white">
              ₱{statistics.avgValue.toLocaleString()}
            </Title>
          </div>
          <ThemeIcon variant="white" color="orange" size="lg" radius="md">
            <IconAdjustments size={18} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* Total Profit Card */}
      <Card
        shadow="sm"
        padding="md"
        radius="md"
        style={{ background: '#9775fa', color: 'white' }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Text c="white" size="xs" style={{ opacity: 0.85 }}>
              Total Profit
            </Text>
            <Title order={3} c="white">
              ₱{statistics.totalProfit.toLocaleString()}
            </Title>
          </div>
          <ThemeIcon variant="white" color="purple" size="lg" radius="md">
            <IconTrendingUp size={18} />
          </ThemeIcon>
        </Group>
      </Card>
    </SimpleGrid>
  );
}
