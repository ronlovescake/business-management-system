import { memo } from 'react';
import { Grid, Paper, Text, Group } from '@mantine/core';
import type { CashAdvanceStats } from '../types';

interface StatsCardsProps {
  stats: CashAdvanceStats[];
}

export const StatsCards = memo(function StatsCards({ stats }: StatsCardsProps) {
  return (
    <Grid mb="md">
      {stats.map((stat, index) => {
        const cardKey = stat.title
          ? `cash-advance-stat-${stat.title}-${index}`
          : `cash-advance-stat-${index}`;

        return (
          <Grid.Col key={cardKey} span={{ base: 12, sm: 6, md: 3 }}>
            <Paper
              p="md"
              radius="md"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.3s ease',
              }}
              styles={{
                root: {
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
                  },
                },
              }}
            >
              <Group justify="apart" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  {stat.title}
                </Text>
                <div style={{ color: stat.color }}>{stat.icon}</div>
              </Group>
              <Text size="xl" fw={700} mb="xs">
                {stat.value}
              </Text>
              <Text size="xs" c="dimmed">
                {stat.description}
              </Text>
            </Paper>
          </Grid.Col>
        );
      })}
    </Grid>
  );
});
