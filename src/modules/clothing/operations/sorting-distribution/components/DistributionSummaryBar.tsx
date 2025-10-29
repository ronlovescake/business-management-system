import { Card, Stack, Text } from '@mantine/core';
import type {
  DistributionRow,
  SortingDistributionStatistics,
} from '../types/sortingDistribution.types';

export interface ColumnLayout {
  rowHeaderWidth: number;
  colWidths: number[];
}

interface DistributionSummaryBarProps {
  rows: DistributionRow[];
  statistics: SortingDistributionStatistics;
  selectedQuantity: number | null;
  isSaving: boolean;
  columnLayout: ColumnLayout | null;
}

/**
 * Compact summary bar that mirrors the data footer pattern from the expenses page.
 */
export function DistributionSummaryBar({
  rows,
  statistics,
  selectedQuantity: _selectedQuantity,
  isSaving,
  columnLayout,
}: DistributionSummaryBarProps) {
  const totalDistribution = statistics.totalDistribution.toLocaleString();
  const totalQuantity = rows
    .reduce((sum, row) => sum + (row.quantity || 0), 0)
    .toLocaleString();
  const availableStock = statistics.availableStock.toLocaleString();
  const availableStockColor = statistics.availableStock < 0 ? 'red' : undefined;
  const totalOrders = statistics.totalReservation.toLocaleString();

  const gridTemplateColumns = columnLayout
    ? [columnLayout.rowHeaderWidth, ...columnLayout.colWidths]
        .map((width) => `${Math.max(width, 0)}px`)
        .join(' ')
    : 'repeat(6, minmax(0, 1fr))';

  const totalWidth = columnLayout
    ? `${
        columnLayout.rowHeaderWidth +
        columnLayout.colWidths.reduce((sum, width) => sum + width, 0)
      }px`
    : undefined;

  return (
    <Card withBorder padding={0} radius="md" style={{ overflowX: 'auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns,
          alignItems: 'center',
          gap: 0,
          minWidth: totalWidth,
          paddingBlock: '0.5rem',
          paddingInline: 0,
        }}
      >
        <div aria-hidden style={{ width: '100%', height: '100%' }} />

        <Stack gap={2} align="center" justify="center">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" lh={1.2}>
            Total Quantity
          </Text>
          <Text size="sm" fw={600}>
            {totalQuantity}
          </Text>
        </Stack>

        <Stack gap={2} align="center" justify="center">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" lh={1.2}>
            Available Stock
          </Text>
          <Text size="sm" fw={600} c={availableStockColor}>
            {availableStock}
          </Text>
        </Stack>

        <Stack gap={2} align="center" justify="center">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" lh={1.2}>
            Total Orders
          </Text>
          <Text size="sm" fw={600}>
            {totalOrders}
          </Text>
        </Stack>

        <Stack gap={2} align="center" justify="center">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" lh={1.2}>
            Total Distribution
          </Text>
          <Text size="sm" fw={600}>
            {totalDistribution}
          </Text>
        </Stack>

        <Stack gap={2} align="center" justify="center">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" lh={1.2}>
            Status
          </Text>
          <Text size="sm" c={isSaving ? 'blue' : 'green'} fw={500}>
            {isSaving ? 'Saving…' : 'All changes saved'}
          </Text>
        </Stack>
      </div>
    </Card>
  );
}
