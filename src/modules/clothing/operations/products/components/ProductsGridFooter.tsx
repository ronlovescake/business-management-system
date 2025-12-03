import { Group, Text } from '@mantine/core';

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
        Total Value: ₱{totalValue.toLocaleString()} | Total Profit: ₱
        {totalProfit.toLocaleString()}
      </Text>
    </Group>
  );
}
