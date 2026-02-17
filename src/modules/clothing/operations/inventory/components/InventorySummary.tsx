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
            P.O. Quantity Total: {numberFormatter.format(totals.quantity)}
          </Text>
          <Text size="sm" c="dimmed">
            Sellable: {numberFormatter.format(totals.availableStock)}
          </Text>
          <Text size="sm" c="dimmed">
            Reserved: {numberFormatter.format(totals.onHandReserved)}
          </Text>
          <Text size="sm" c="dimmed">
            Damaged: {numberFormatter.format(totals.damagedOnHand)}
          </Text>
          <Text size="sm" c="dimmed">
            Actual Quantity: {numberFormatter.format(totals.onhand)}
          </Text>
          <Text size="sm" c="dimmed">
            Supplier Short: {numberFormatter.format(totals.supplierShortQty)}
          </Text>
          {/*
            ========================================================================
            ⚠️ COMPLETED TOTAL SALES (NOT ACCOUNTING REVENUE)
            ========================================================================
            This value is derived from completed statuses on the Inventory page
            (Ready For Dispatch, Checked Out, Shipped, Pending Payment).
            Prepared + fully paid is also treated as completed.
            Intended for operations tracking only.
            ========================================================================
          */}
          <Text size="sm" c="dimmed">
            Total Sales (Completed Orders):{' '}
            {currencyFormatter.format(totals.totalSales)}
          </Text>
          <Text size="sm" c="dimmed">
            Ending Value (Sellable):{' '}
            {currencyFormatter.format(totals.endingInventoryValue)}
          </Text>
        </Group>
      </Group>
    );
  }
);

InventorySummary.displayName = 'InventorySummary';
