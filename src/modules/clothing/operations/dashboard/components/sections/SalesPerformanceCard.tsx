import {
  ActionIcon,
  Box,
  Card,
  Center,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconChartBar,
  IconReceipt,
  IconRefresh,
  IconTruck,
} from '@tabler/icons-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  NameType,
  ValueType,
} from 'recharts/types/component/DefaultTooltipContent';
import type { TooltipProps } from 'recharts';
import { FormatterService } from '@/services/FormatterService';
import type {
  SalesTrendDataset,
  TrendRange,
} from '../../types/dashboard.types';

const trendOptions: { label: string; value: TrendRange }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

export interface TrendSummary {
  totalRevenue: number;
  avgOrders: number;
  fulfillmentRate: number;
}

interface SalesPerformanceCardProps {
  dataset: SalesTrendDataset | null;
  summary: TrendSummary;
  trendRange: TrendRange;
  onTrendRangeChange: (range: TrendRange) => void;
}

export function SalesPerformanceCard({
  dataset,
  summary,
  trendRange,
  onTrendRangeChange,
}: SalesPerformanceCardProps) {
  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      className="modern-card"
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={3}>Sales Performance</Title>
            <Text size="sm" c="dimmed">
              Revenue vs. orders with fulfillment health.
            </Text>
          </div>
          <Group gap="xs">
            <Tooltip label="Refresh insights" position="bottom">
              <ActionIcon variant="subtle" color="gray" radius="xl" size="lg">
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
            <SegmentedControl
              data={trendOptions}
              value={dataset?.range ?? trendRange}
              onChange={(value) => onTrendRangeChange(value as TrendRange)}
              color="pink"
            />
          </Group>
        </Group>
        <Box h={280}>
          {dataset ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={dataset.points}
                margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="revenueGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  opacity={0.5}
                />
                <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} />
                <YAxis hide domain={[0, 'auto']} />
                <RechartsTooltip
                  content={<TrendTooltip />}
                  cursor={{ stroke: '#cbd5f5', strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#db2777"
                  fill="url(#revenueGradient)"
                  strokeWidth={3}
                />
                <Area
                  type="monotone"
                  dataKey="orders"
                  stroke="#0284c7"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Center h="100%">
              <Text c="dimmed">
                Trend data will appear once orders flow in.
              </Text>
            </Center>
          )}
        </Box>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <TrendHighlight
            label="Total Revenue"
            value={FormatterService.formatCurrency(summary.totalRevenue)}
            description="Selected period"
          />
          <TrendHighlight
            label="Avg. Orders"
            value={FormatterService.formatNumber(summary.avgOrders, 0)}
            description="Per day"
          />
          <TrendHighlight
            label="Fulfillment"
            value={`${summary.fulfillmentRate}%`}
            description="On-time shipments"
          />
        </SimpleGrid>
      </Stack>
    </Card>
  );
}

interface TrendHighlightProps {
  label: string;
  value: string;
  description: string;
}

function TrendHighlight({ label, value, description }: TrendHighlightProps) {
  return (
    <Card padding="sm" radius="md" withBorder>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={600}>{value}</Text>
      <Text size="xs" c="dimmed">
        {description}
      </Text>
    </Card>
  );
}

function TrendTooltip({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType> & {
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const revenuePoint = payload.find((point) => point.dataKey === 'revenue');
  const ordersPoint = payload.find((point) => point.dataKey === 'orders');
  const fulfillmentPoint = payload.find(
    (point) => point.dataKey === 'fulfillmentRate'
  );

  return (
    <Paper withBorder p="sm" radius="md">
      <Stack gap={4}>
        <Text fw={600}>{label}</Text>
        {revenuePoint && (
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light" color="pink" radius="sm">
              <IconChartBar size={14} />
            </ThemeIcon>
            <Text size="sm">
              {FormatterService.formatCurrency(Number(revenuePoint.value))}
            </Text>
          </Group>
        )}
        {ordersPoint && (
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light" color="blue" radius="sm">
              <IconReceipt size={14} />
            </ThemeIcon>
            <Text size="sm">{ordersPoint.value ?? 0} orders</Text>
          </Group>
        )}
        {fulfillmentPoint && (
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light" color="teal" radius="sm">
              <IconTruck size={14} />
            </ThemeIcon>
            <Text size="sm">{fulfillmentPoint.value}% fulfill rate</Text>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
