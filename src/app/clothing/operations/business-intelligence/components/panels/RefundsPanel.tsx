import { memo } from 'react';
import { Button, Center, Loader, SimpleGrid, Text } from '@mantine/core';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartCard } from '@/components/charts/ChartCard';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import {
  CHART_MARGIN,
  CHART_PALETTE,
  chartAxisProps,
  chartGridProps,
  formatCompactPeso,
} from '@/components/charts/chartTheme';
import {
  RefundPending,
  useRefundObligations,
} from '@/components/refunds/RefundPending';

interface RefundsPanelProps {
  asOf: string;
  from?: string;
  formatCurrency: (value: number) => string;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={600} c="dark.7">
        {value}
      </Text>
    </div>
  );
}

export const RefundsPanel = memo(function RefundsPanel({
  asOf,
  from,
  formatCurrency,
}: RefundsPanelProps) {
  const query = useRefundObligations(asOf, from);
  const { data } = query;

  return (
    <ChartCard
      title="Refunds"
      subtitle="Approved refunds paid by month"
      actions={<RefundPending variant="icon" asOf={asOf} from={from} />}
    >
      {query.isLoading ? (
        <Center h={240}>
          <Loader size="sm" />
        </Center>
      ) : !data ? (
        <Center h={240} style={{ flexDirection: 'column', gap: 8 }}>
          <Text size="sm" c="red">
            Refund totals could not be loaded.
          </Text>
          <Button
            variant="subtle"
            size="xs"
            onClick={() => void query.refetch()}
          >
            Retry
          </Button>
        </Center>
      ) : (
        <>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" mb="md">
            <Stat
              label="Refund pending"
              value={formatCurrency(data.pendingAmount)}
            />
            <Stat
              label="Pending orders"
              value={`${data.transactionCount} | Oldest ${data.oldestAgeDays}d`}
            />
            <Stat
              label="Approved refunds paid"
              value={formatCurrency(data.paidApprovedRefundAmount)}
            />
            <Stat
              label="Approved retained deposits"
              value={formatCurrency(data.retainedDepositAmount)}
            />
          </SimpleGrid>
          {data.paidRefundTrends.length === 0 ? (
            <Center h={200}>
              <Text size="sm" c="dimmed">
                No approved refund payouts in this period.
              </Text>
            </Center>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={data.paidRefundTrends}
                margin={CHART_MARGIN}
                aria-label="Approved refunds paid by month"
              >
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="month" {...chartAxisProps} />
                <YAxis
                  {...chartAxisProps}
                  width={56}
                  tickFormatter={formatCompactPeso}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(76, 110, 245, 0.06)' }}
                  content={
                    <ChartTooltip
                      valueFormatter={(value) => formatCurrency(value)}
                    />
                  }
                />
                <Bar
                  dataKey="amount"
                  name="Paid"
                  fill={CHART_PALETTE.primary}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </>
      )}
    </ChartCard>
  );
});
