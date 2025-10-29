/**
 * Info Section Component
 *
 * Displays product selection, statistics, and information fields.
 */

import React from 'react';
import { Card, Stack, Group, Text, Select, Flex } from '@mantine/core';
import type { SortingDistributionStatistics } from '../types/sortingDistribution.types';
import { QuantityPillButtons } from './QuantityPillButtons';

export interface InfoSectionProps {
  // Form fields
  item: string;
  ordered: string;
  productOptions: string[];

  // Statistics
  statistics: SortingDistributionStatistics;

  // Quantity filters
  uniqueQuantities: number[];
  selectedQuantity: number | null;
  onSelectQuantity: (quantity: number | null) => void;

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
  uniqueQuantities,
  selectedQuantity,
  onSelectQuantity,
  onItemChange,
}: InfoSectionProps) {
  const Stat = ({
    label,
    value,
    color,
    emphasize,
  }: {
    label: string;
    value: string;
    color?: string;
    emphasize?: boolean;
  }) => (
    <Stack
      gap={4}
      align="flex-end"
      style={{ minWidth: '104px', flex: '0 0 auto' }}
    >
      <Text size="xs" c="dimmed" fw={600} tt="uppercase" lh={1.2}>
        {label}
      </Text>
      <Text
        size="sm"
        fw={emphasize ? 600 : 500}
        c={color}
        style={{ whiteSpace: 'nowrap' }}
      >
        {value}
      </Text>
    </Stack>
  );

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Flex
        gap="xl"
        justify="space-between"
        align="flex-end"
        wrap="wrap"
        style={{ rowGap: '0.75rem' }}
      >
        <Stack gap={6} style={{ minWidth: '260px', flex: '0 0 auto' }}>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" lh={1.2}>
            Product Code
          </Text>
          <Select
            value={item}
            onChange={(value) => onItemChange(value || '')}
            data={productOptions}
            placeholder="Select a product..."
            searchable
            clearable
            comboboxProps={{ withinPortal: true }}
          />
          {uniqueQuantities.length > 0 && (
            <Group gap="xs" wrap="wrap">
              <QuantityPillButtons
                uniqueQuantities={uniqueQuantities}
                selectedQuantity={selectedQuantity}
                onSelectQuantity={onSelectQuantity}
              />
            </Group>
          )}
        </Stack>

        <Group
          gap="lg"
          align="flex-end"
          justify="flex-end"
          wrap="wrap"
          style={{ flex: '1 1 auto', columnGap: '1.75rem', rowGap: '0.75rem' }}
        >
          <Stat label="Ordered" value={(ordered || '0').toString()} />
          <Stat
            label="Total Customers"
            value={statistics.totalCustomers.toLocaleString()}
          />
          <Stat
            label="Customer w/ Order Qty"
            value={statistics.customerWithOrderQty.toLocaleString()}
          />
        </Group>
      </Flex>
    </Card>
  );
}
