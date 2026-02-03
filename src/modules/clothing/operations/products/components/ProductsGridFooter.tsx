import { Group, Text } from '@mantine/core';
import { formatNumber } from '@/lib/formatters';

interface ProductsGridFooterProps {
  filteredCount: number;
  totalCount: number;
  totalValue: number;
  totalProfit: number;
}

export function ProductsGridFooter({
  filteredCount,
  totalCount,
  totalValue,
  totalProfit,
}: ProductsGridFooterProps) {
  return (
    <Group justify="space-between" align="center" mt="md">
      <Text size="sm" c="dimmed">
        Showing {filteredCount} of {totalCount} products
      </Text>
      <Text size="sm" c="dimmed">
        Total Value: ₱{formatNumber(totalValue)} | Total Profit: ₱
        {formatNumber(totalProfit)}
      </Text>
    </Group>
  );
}
