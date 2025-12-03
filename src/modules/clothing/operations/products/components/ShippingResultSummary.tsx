import { memo } from 'react';
import { SimpleGrid, Paper, Stack, Text } from '@mantine/core';
import type { ShippingResultSummaryData } from '../hooks/useShippingFeeCalculator';

interface ShippingResultSummaryProps {
  summary: ShippingResultSummaryData;
}

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-PH', {
  maximumFractionDigits: 0,
});

export const ShippingResultSummary = memo(
  ({ summary }: ShippingResultSummaryProps) => {
    const summaryCards = [
      {
        label: 'Products',
        value: numberFormatter.format(summary.totalProducts),
        description: 'Products in shipment',
      },
      {
        label: 'Actual Qty',
        value: numberFormatter.format(summary.totalActualQuantity),
        description: 'Actual total quantity',
      },
      {
        label: 'Approx Qty',
        value: numberFormatter.format(summary.totalApproxQuantity),
        description: 'Multiplier-adjusted quantity',
      },
      {
        label: 'Alibaba Shipping',
        value: currencyFormatter.format(summary.totalAlibabaShipping),
        description: 'Estimated allocation',
      },
      {
        label: "Forwarder's Fee",
        value: currencyFormatter.format(summary.totalForwardersFee),
        description: 'KPC allocation',
      },
      {
        label: 'Lalamove / Packaging',
        value: currencyFormatter.format(summary.totalLalamove),
        description: 'Final-mile allocation',
      },
    ];

    return (
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {summaryCards.map((card) => (
          <Paper key={card.label} withBorder p="md" radius="md">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">
                {card.label}
              </Text>
              <Text fw={600} size="lg">
                {card.value}
              </Text>
              <Text size="xs" c="dimmed">
                {card.description}
              </Text>
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
    );
  }
);

ShippingResultSummary.displayName = 'ShippingResultSummary';
