import React from 'react';
import { Paper, Group, Text, Grid } from '@mantine/core';
import {
  IconReceipt,
  IconX,
  IconCheck,
  IconDownload,
} from '@tabler/icons-react';

interface StatsCardsProps {
  totalExpenses: number;
  pendingExpenses: number;
  approvedExpenses: number;
  thisMonthExpenses: number;
  formatCurrency: (amount: number) => string;
}

/**
 * StatsCards Component
 *
 * Displays 4 glassmorphism-styled stat cards showing:
 * - Total Expenses
 * - Pending Approval
 * - Approved Total
 * - This Month's Expenses
 */
export function StatsCards({
  totalExpenses,
  pendingExpenses,
  approvedExpenses,
  thisMonthExpenses,
  formatCurrency,
}: StatsCardsProps) {
  const stats = [
    {
      title: 'Total Expenses',
      value: formatCurrency(totalExpenses),
      icon: <IconReceipt size={32} stroke={1.5} />,
      color: 'blue',
    },
    {
      title: 'Pending Approval',
      value: pendingExpenses.toString(),
      icon: <IconX size={32} stroke={1.5} />,
      color: 'red',
    },
    {
      title: 'Approved Total',
      value: formatCurrency(approvedExpenses),
      icon: <IconCheck size={32} stroke={1.5} />,
      color: 'green',
    },
    {
      title: 'This Month',
      value: formatCurrency(thisMonthExpenses),
      icon: <IconDownload size={32} stroke={1.5} />,
      color: 'teal',
    },
  ];

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
