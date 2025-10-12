/**
 * Info Section Component
 *
 * Displays product selection, statistics, and information fields.
 */

import React from 'react';
import { Card, Grid, Stack, Group, Text, Select } from '@mantine/core';
import { SortingDistributionStatistics } from '../types/sortingDistribution.types';

export interface InfoSectionProps {
  // Form fields
  item: string;
  ordered: string;
  productOptions: string[];

  // Statistics
  statistics: SortingDistributionStatistics;

  // Actions
  onItemChange: (item: string) => void;
}

/**
 * Info Section Component
 * Displays product selection and calculated statistics
 */
export function InfoSection({
  item,
  ordered,
  productOptions,
  statistics,
  onItemChange,
}: InfoSectionProps) {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Grid gutter="md">
        {/* Left Column */}
        <Grid.Col span={6}>
          <Stack gap="xs">
            <Group gap="xs">
              <Text size="sm" fw={500} style={{ minWidth: '140px' }}>
                Product Code
              </Text>
              <Select
                value={item}
                onChange={(value) => onItemChange(value || '')}
                data={productOptions}
                placeholder="Select a product..."
                searchable
                clearable
                style={{ flex: 1 }}
              />
            </Group>

            <Group gap="xs">
              <Text size="sm" fw={500} style={{ minWidth: '140px' }}>
                Ordered
              </Text>
              <Text size="sm" style={{ flex: 1 }}>
                {ordered || '0'}
              </Text>
            </Group>

            <Group gap="xs">
              <Text size="sm" fw={500} style={{ minWidth: '140px' }}>
                Est. Qty. Received
              </Text>
              <Text size="sm" style={{ flex: 1 }}>
                {statistics.estQtyReceived.toLocaleString()}
              </Text>
            </Group>

            <Group gap="xs">
              <Text size="sm" fw={500} style={{ minWidth: '140px' }}>
                Total Reservation
              </Text>
              <Text size="sm" style={{ flex: 1 }}>
                {statistics.totalReservation.toLocaleString()}
              </Text>
            </Group>
          </Stack>
        </Grid.Col>

        {/* Right Column */}
        <Grid.Col span={6}>
          <Stack gap="xs">
            <Group gap="xs">
              <Text size="sm" fw={500} style={{ minWidth: '140px' }}>
                Available Stock
              </Text>
              <Text
                size="sm"
                style={{ flex: 1 }}
                c={statistics.availableStock < 0 ? 'red' : undefined}
              >
                {statistics.availableStock.toLocaleString()}
              </Text>
            </Group>

            <Group gap="xs">
              <Text size="sm" fw={500} style={{ minWidth: '140px' }}>
                Total Customers
              </Text>
              <Text size="sm" style={{ flex: 1 }}>
                {statistics.totalCustomers.toLocaleString()}
              </Text>
            </Group>

            <Group gap="xs">
              <Text size="sm" fw={500} style={{ minWidth: '140px' }}>
                Customer w/ Order Qty
              </Text>
              <Text size="sm" style={{ flex: 1 }}>
                {statistics.customerWithOrderQty.toLocaleString()}
              </Text>
            </Group>

            <Group gap="xs">
              <Text size="sm" fw={500} style={{ minWidth: '140px' }}>
                Total Distribution
              </Text>
              <Text size="sm" style={{ flex: 1 }} fw={600}>
                {statistics.totalDistribution.toLocaleString()}
              </Text>
            </Group>
          </Stack>
        </Grid.Col>
      </Grid>
    </Card>
  );
}
