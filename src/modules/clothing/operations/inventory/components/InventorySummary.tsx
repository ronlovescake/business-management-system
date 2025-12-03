import { memo } from 'react';
import { Group, Text } from '@mantine/core';
import type { InventoryTotals } from '../types';
import { numberFormatter, currencyFormatter } from '../lib/formatters';

interface InventorySummaryProps {
  filteredCount: number;
  totalCount: number;
  totals: InventoryTotals;
}

export const InventorySummary = memo(
  ({ filteredCount, totalCount, totals }: InventorySummaryProps) => {
    return (
      <Group justify="space-between" align="center" wrap="wrap">
        <Text size="sm" c="dimmed">
          Showing {filteredCount} of {totalCount} inventory items
        </Text>
        <Group gap="lg" wrap="wrap">
          <Text size="sm" c="dimmed">
            Total Onhand: {numberFormatter.format(totals.onhand)}
          </Text>
          <Text size="sm" c="dimmed">
            Available: {numberFormatter.format(totals.availableStock)}
          </Text>
          <Text size="sm" c="dimmed">
            Ending Value:{' '}
            {currencyFormatter.format(totals.endingInventoryValue)}
          </Text>
        </Group>
      </Group>
    );
  }
);

InventorySummary.displayName = 'InventorySummary';
