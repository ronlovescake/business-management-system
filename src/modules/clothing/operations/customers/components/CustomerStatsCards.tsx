'use client';

import React from 'react';
import { Card, Group, Text, Title, ThemeIcon, SimpleGrid } from '@mantine/core';
import {
  IconUsers,
  IconFilter,
  IconBuildingStore,
  IconPhone,
} from '@tabler/icons-react';
import { CustomerStats } from '../types/customer.types';

interface CustomerStatsCardsProps {
  stats: CustomerStats;
}

/**
 * Customer Statistics Cards Component
 * Displays 4 stat cards: Total, Filtered, Unique Businesses, Contactable
 */
export function CustomerStatsCards({ stats }: CustomerStatsCardsProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
      {/* Total Customers */}
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
              Total customers
            </Text>
            <Title order={3} c="white">
              {stats.total}
            </Title>
          </div>
          <ThemeIcon variant="white" color="blue" size="lg" radius="md">
            <IconUsers size={18} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* In Current View */}
      <Card
        shadow="sm"
        padding="md"
        radius="md"
        style={{
          background: 'var(--mantine-color-grape-6)',
          color: 'white',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Text c="white" size="xs" style={{ opacity: 0.85 }}>
              In current view
            </Text>
            <Title order={3} c="white">
              {stats.filtered}
            </Title>
          </div>
          <ThemeIcon variant="white" color="grape" size="lg" radius="md">
            <IconFilter size={18} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* Unique Businesses */}
      <Card
        shadow="sm"
        padding="md"
        radius="md"
        style={{
          background: 'var(--mantine-color-teal-6)',
          color: 'white',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Text c="white" size="xs" style={{ opacity: 0.85 }}>
              Unique businesses
            </Text>
            <Title order={3} c="white">
              {stats.uniqueBusinesses}
            </Title>
          </div>
          <ThemeIcon variant="white" color="teal" size="lg" radius="md">
            <IconBuildingStore size={18} />
          </ThemeIcon>
        </Group>
      </Card>

      {/* Contactable */}
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
              Contactable
            </Text>
            <Title order={3} c="white">
              {stats.contactable}{' '}
              <Text
                component="span"
                size="sm"
                c="white"
                style={{ opacity: 0.85 }}
              >
                ({stats.contactablePct}%)
              </Text>
            </Title>
          </div>
          <ThemeIcon variant="white" color="green" size="lg" radius="md">
            <IconPhone size={18} />
          </ThemeIcon>
        </Group>
      </Card>
    </SimpleGrid>
  );
}
