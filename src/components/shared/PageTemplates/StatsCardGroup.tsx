import React from 'react';
import { Paper, Group, Text, Grid } from '@mantine/core';

export interface StatCard {
  title: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
}

interface StatsCardGroupProps {
  stats: StatCard[];
}

/**
 * StatsCardGroup Component
 *
 * Reusable glassmorphism-styled stats cards that can be used across any page.
 * Displays 4 cards in a grid with hover effects.
 *
 * @example
 * ```tsx
 * const stats = [
 *   { title: 'Total', value: '100', icon: <IconReceipt size={32} /> },
 *   { title: 'Pending', value: '10', icon: <IconClock size={32} /> },
 * ];
 * <StatsCardGroup stats={stats} />
 * ```
 */
export function StatsCardGroup({ stats }: StatsCardGroupProps) {
  return (
    <Grid>
      {stats.map((stat, index) => (
        <Grid.Col key={index} span={{ base: 12, sm: 6, md: 3 }}>
          <Paper
            p="lg"
            radius="xl"
            style={{
              background: 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow =
                '0 12px 40px 0 rgba(31, 38, 135, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow =
                '0 8px 32px 0 rgba(31, 38, 135, 0.37)';
            }}
          >
            <Group justify="space-between">
              <div>
                <Text
                  size="xs"
                  tt="uppercase"
                  fw={700}
                  style={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    letterSpacing: '0.5px',
                  }}
                >
                  {stat.title}
                </Text>
                <Text
                  size="xl"
                  fw={700}
                  mt={4}
                  style={{
                    color: 'rgba(255, 255, 255, 0.95)',
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  {stat.value}
                </Text>
              </div>
              <div
                style={{
                  opacity: 0.8,
                  filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
                }}
              >
                {stat.icon}
              </div>
            </Group>
          </Paper>
        </Grid.Col>
      ))}
    </Grid>
  );
}
