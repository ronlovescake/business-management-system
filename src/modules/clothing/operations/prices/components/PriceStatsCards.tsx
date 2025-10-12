import { Card, Group, Text, Title, ThemeIcon, SimpleGrid } from '@mantine/core';
import {
  IconCurrencyDollar,
  IconTrendingUp,
  IconTrendingDown,
} from '@tabler/icons-react';
import { PriceStats } from '../types/price.types';

interface PriceStatsCardsProps {
  stats: PriceStats;
}

/**
 * Display price statistics cards
 */
export function PriceStatsCards({ stats }: PriceStatsCardsProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
      {/* Total Products */}
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
              {stats.total}
            </Title>
          </div>
          <ThemeIcon variant="white" color="blue" size="lg" radius="md">
            <IconCurrencyDollar size={18} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* Average Price */}
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
              Average Price
            </Text>
            <Title order={3} c="white">
              ₱{stats.avgPrice.toLocaleString()}
            </Title>
          </div>
          <ThemeIcon variant="white" color="green" size="lg" radius="md">
            <IconTrendingUp size={18} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* Price Increases */}
      <Card
        shadow="sm"
        padding="md"
        radius="md"
        style={{
          background: 'var(--mantine-color-orange-6)',
          color: 'white',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Text c="white" size="xs" style={{ opacity: 0.85 }}>
              Price Increases
            </Text>
            <Title order={3} c="white">
              {stats.priceIncreases}
            </Title>
          </div>
          <ThemeIcon variant="white" color="orange" size="lg" radius="md">
            <IconTrendingUp size={18} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* Price Decreases */}
      <Card
        shadow="sm"
        padding="md"
        radius="md"
        style={{
          background: 'var(--mantine-color-red-6)',
          color: 'white',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Text c="white" size="xs" style={{ opacity: 0.85 }}>
              Price Decreases
            </Text>
            <Title order={3} c="white">
              {stats.priceDecreases}
            </Title>
          </div>
          <ThemeIcon variant="white" color="red" size="lg" radius="md">
            <IconTrendingDown size={18} />
          </ThemeIcon>
        </Group>
      </Card>
    </SimpleGrid>
  );
}
