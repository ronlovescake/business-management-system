'use client';

import { Profiler, memo, useMemo, useState } from 'react';
import {
  Box,
  Center,
  Grid,
  Group,
  Loader,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconCalendar } from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  useBusinessIntelligence,
  filterOptions,
} from '../hooks/useBusinessIntelligence';
import { COMPARISON_CAPTIONS, PERIOD_BADGE_LABELS } from '../constants';
import type { DateFilterType } from '../types';
import { onRenderCallback } from '@/lib/performance/monitoring';
import { OrderPipelinePanel } from './panels/OrderPipelinePanel';
import { CustomerMixPanel } from './panels/CustomerMixPanel';
import { WeekdaySalesPanel } from './panels/WeekdaySalesPanel';
import { ProfitSnapshotPanel } from './panels/ProfitSnapshotPanel';
import { ChartCard } from '@/components/charts/ChartCard';
import { RefundPending } from '@/components/refunds/RefundPending';
import { InventoryValuationNotice } from '@/components/accounting/InventoryValuationNotice';
import { getFilterStart } from '@/lib/analytics/periodComparison';
import { getCurrentDateISO, toISODate } from '@/utils/date';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { KpiCard } from '@/components/charts/KpiCard';
import {
  CHART_MARGIN,
  CHART_PALETTE,
  CHART_SERIES_COLORS,
  chartAxisProps,
  chartGridProps,
  formatCompactPeso,
} from '@/components/charts/chartTheme';

interface BiDashboardProps {
  apiBasePath?: string;
}

const tableStyles = {
  th: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
    color: 'var(--mantine-color-dimmed)',
  },
};

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Box
        w={8}
        h={8}
        style={{ borderRadius: '50%', backgroundColor: color }}
      />
      <Text size="xs" c="dimmed">
        {label}
      </Text>
    </Group>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
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

export const BiDashboard = memo(function BiDashboard({
  apiBasePath,
}: BiDashboardProps) {
  const {
    dateFilter,
    setDateFilter,
    isLoading,
    products,
    shipments,
    metrics,
    profit,
    formatCurrency,
    formatNumber,
  } = useBusinessIntelligence(apiBasePath);
  const [productView, setProductView] = useState<'chart' | 'table'>('chart');
  // Mantine's default xl breakpoint; wide screens show chart and table together.
  const isWide = useMediaQuery('(min-width: 88em)') ?? false;

  const customerSlices = useMemo(() => {
    const top = metrics.topCustomers.slice(0, 5).map((c) => ({
      name: c.customerName,
      value: c.totalAmount,
      orders: c.orderCount,
    }));
    const others =
      metrics.ytdTotal - top.reduce((sum, slice) => sum + slice.value, 0);
    return others > 0.005
      ? [...top, { name: 'Others', value: others, orders: null }]
      : top;
  }, [metrics.topCustomers, metrics.ytdTotal]);

  if (isLoading) {
    return (
      <Center h={400}>
        <Loader size="lg" />
      </Center>
    );
  }

  const periodBadge = PERIOD_BADGE_LABELS[dateFilter];
  const refundStart = getFilterStart(dateFilter);
  const comparisonCaption = COMPARISON_CAPTIONS[dateFilter];
  const formatTooltipValue = (value: number, key: string) =>
    key === 'revenue' || key === 'totalValue'
      ? formatCurrency(value)
      : key === 'cbm'
        ? formatNumber(value)
        : value.toLocaleString('en-US');

  return (
    <Profiler id="BiDashboard" onRender={onRenderCallback}>
      <Stack gap="lg">
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <div>
            <Title order={2} fw={700} c="dark.8">
              Business intelligence
            </Title>
            <Text size="sm" c="dimmed">
              Sales, customers and shipment performance
            </Text>
          </div>
          <Select
            data={filterOptions}
            value={dateFilter}
            onChange={(value) =>
              setDateFilter((value as DateFilterType) || 'ytd')
            }
            allowDeselect={false}
            w={190}
            size="sm"
            radius="md"
            aria-label="Time period"
            leftSection={<IconCalendar size={16} />}
            comboboxProps={{ shadow: 'md' }}
          />
        </Group>

        {apiBasePath !== '/api/general-merchandise' && (
          <RefundPending
            showPaid
            showTrends
            asOf={getCurrentDateISO()}
            from={refundStart ? toISODate(refundStart) : undefined}
          />
        )}
        {profit.enabled && (
          <InventoryValuationNotice valuation={profit.data?.valuation} />
        )}
        <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 6 }} spacing="md">
          <KpiCard
            label="Revenue"
            value={formatCurrency(metrics.ytdTotal)}
            badge={periodBadge}
            delta={metrics.deltas.revenue}
            deltaCaption={comparisonCaption}
            caption="Selected period"
          />
          <KpiCard
            label="Month to date"
            value={formatCurrency(metrics.mtdTotal)}
            badge="MTD"
            delta={metrics.deltas.mtd}
            deltaCaption={COMPARISON_CAPTIONS.mtd}
            caption="Current month"
          />
          <KpiCard
            label="Transactions"
            value={metrics.transactionCount.toLocaleString('en-US')}
            badge={periodBadge}
            delta={metrics.deltas.transactions}
            deltaCaption={comparisonCaption}
            caption="Selected period"
          />
          <KpiCard
            label="Total COGS"
            value={formatCurrency(metrics.totalCOGS)}
            caption="All products"
          />
          <KpiCard
            label="Total CBM"
            value={formatNumber(metrics.totalCBM)}
            caption="All shipments"
          />
          <KpiCard
            label="Total sacks"
            value={metrics.totalSacks.toLocaleString('en-US')}
            caption="All shipments"
          />
          <KpiCard
            label="Customers"
            value={metrics.extended.uniqueCustomers.toLocaleString('en-US')}
            badge={periodBadge}
            delta={metrics.deltas.customers}
            deltaCaption={comparisonCaption}
            caption="Unique buyers"
          />
          <KpiCard
            label="Quantity sold"
            value={metrics.extended.quantitySold.toLocaleString('en-US')}
            badge={periodBadge}
            delta={metrics.deltas.quantity}
            deltaCaption={comparisonCaption}
            caption="Units"
          />
          <KpiCard
            label="Avg. order value"
            value={
              metrics.extended.averageOrderValue === null
                ? '—'
                : formatCurrency(metrics.extended.averageOrderValue)
            }
            badge={periodBadge}
            delta={metrics.deltas.averageOrderValue}
            deltaCaption={comparisonCaption}
            caption="Per transaction"
          />
          <KpiCard
            label="Adjustments"
            value={formatCurrency(metrics.extended.adjustmentsTotal)}
            badge={periodBadge}
            caption="Excludes cancelled orders"
          />
          <KpiCard
            label="Lost revenue"
            value={formatCurrency(metrics.extended.lostRevenue.value)}
            badge={periodBadge}
            caption={`${metrics.extended.lostRevenue.count.toLocaleString('en-US')} cancelled, forfeited or voided`}
          />
          <KpiCard
            label="Not yet invoiced"
            value={formatCurrency(metrics.extended.notYetInvoiced.value)}
            badge={periodBadge}
            caption={`${metrics.extended.notYetInvoiced.count.toLocaleString('en-US')} orders without invoice date`}
          />
        </SimpleGrid>

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, xl: 6 }}>
            <ChartCard
              title="Revenue & orders"
              subtitle={`Monthly, ${new Date().getFullYear()}`}
              actions={
                <Group gap="md">
                  <LegendDot color={CHART_PALETTE.primary} label="Revenue" />
                  <LegendDot color={CHART_PALETTE.tertiary} label="Orders" />
                </Group>
              }
            >
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={metrics.monthlyTrends} margin={CHART_MARGIN}>
                  <defs>
                    <linearGradient id="bi-revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={CHART_PALETTE.primary}
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor={CHART_PALETTE.primary}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                    <linearGradient id="bi-orders" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={CHART_PALETTE.tertiary}
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor={CHART_PALETTE.tertiary}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="month" {...chartAxisProps} />
                  <YAxis
                    yAxisId="revenue"
                    {...chartAxisProps}
                    width={56}
                    tickFormatter={formatCompactPeso}
                  />
                  <YAxis
                    yAxisId="orders"
                    orientation="right"
                    {...chartAxisProps}
                    width={36}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ stroke: CHART_PALETTE.soft, strokeWidth: 2 }}
                    content={
                      <ChartTooltip valueFormatter={formatTooltipValue} />
                    }
                  />
                  <Area
                    yAxisId="orders"
                    type="monotone"
                    dataKey="transactions"
                    name="Orders"
                    stroke={CHART_PALETTE.secondary}
                    strokeWidth={2}
                    fill="url(#bi-orders)"
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                  <Area
                    yAxisId="revenue"
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke={CHART_PALETTE.primary}
                    strokeWidth={2.5}
                    fill="url(#bi-revenue)"
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6, xl: 3 }}>
            <OrderPipelinePanel
              stages={metrics.extended.pipeline}
              formatCurrency={formatCurrency}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6, xl: 3 }}>
            <ChartCard title="Top customers" subtitle="Share of revenue">
              {customerSlices.length === 0 ? (
                <Center h={260}>
                  <Text size="sm" c="dimmed">
                    No customer sales in this period
                  </Text>
                </Center>
              ) : (
                <>
                  <Box pos="relative" h={190}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={customerSlices}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={62}
                          outerRadius={84}
                          paddingAngle={2}
                          stroke="none"
                          isAnimationActive={false}
                        >
                          {customerSlices.map((slice, index) => (
                            <Cell
                              key={slice.name}
                              fill={
                                CHART_SERIES_COLORS[
                                  index % CHART_SERIES_COLORS.length
                                ]
                              }
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <Center
                      pos="absolute"
                      inset={0}
                      style={{ pointerEvents: 'none', flexDirection: 'column' }}
                    >
                      <Text size="xs" c="dimmed">
                        Total
                      </Text>
                      <Text fw={600} c="dark.7">
                        {formatCompactPeso(metrics.ytdTotal)}
                      </Text>
                    </Center>
                  </Box>
                  <Table
                    mt="xs"
                    verticalSpacing={6}
                    horizontalSpacing={4}
                    styles={tableStyles}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Customer</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>
                          Orders
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>
                          Revenue
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {customerSlices.map((slice, index) => (
                        <Table.Tr key={slice.name}>
                          <Table.Td>
                            <Group gap={8} wrap="nowrap">
                              <Box
                                w={8}
                                h={8}
                                style={{
                                  flexShrink: 0,
                                  borderRadius: '50%',
                                  backgroundColor:
                                    CHART_SERIES_COLORS[
                                      index % CHART_SERIES_COLORS.length
                                    ],
                                }}
                              />
                              <Text size="sm" truncate maw={150}>
                                {slice.name}
                              </Text>
                            </Group>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="sm" c="dimmed">
                              {slice.orders ?? '—'}
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="sm" fw={500}>
                              {formatCurrency(slice.value)}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </>
              )}
            </ChartCard>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <ChartCard
              title="Shipments"
              subtitle={`Monthly, ${new Date().getFullYear()}`}
              actions={
                <Group gap="md">
                  <LegendDot color={CHART_PALETTE.secondary} label="Sacks" />
                  <LegendDot color={CHART_PALETTE.primary} label="CBM" />
                </Group>
              }
            >
              <SimpleGrid cols={3} spacing="xs" mb="md">
                <MiniStat
                  label="Total CBM"
                  value={formatNumber(metrics.totalCBM)}
                />
                <MiniStat
                  label="Total sacks"
                  value={metrics.totalSacks.toLocaleString('en-US')}
                />
                <MiniStat
                  label="Shipments"
                  value={shipments.length.toLocaleString('en-US')}
                />
              </SimpleGrid>
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart
                  data={metrics.monthlyTrends}
                  margin={CHART_MARGIN}
                >
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="month" {...chartAxisProps} />
                  <YAxis
                    yAxisId="sacks"
                    {...chartAxisProps}
                    width={40}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="cbm"
                    orientation="right"
                    {...chartAxisProps}
                    width={40}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(76, 110, 245, 0.06)' }}
                    content={
                      <ChartTooltip
                        valueFormatter={formatTooltipValue}
                        extraRows={(datum) => [
                          {
                            label: 'Shipments',
                            value: String(datum.shipments ?? 0),
                          },
                        ]}
                      />
                    }
                  />
                  <Bar
                    yAxisId="sacks"
                    dataKey="sacks"
                    name="Sacks"
                    fill={CHART_PALETTE.secondary}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={18}
                  />
                  <Line
                    yAxisId="cbm"
                    type="monotone"
                    dataKey="cbm"
                    name="CBM"
                    stroke={CHART_PALETTE.primary}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6, lg: 4 }}>
            <CustomerMixPanel
              months={metrics.extended.customerMix}
              repeatRate={metrics.extended.repeatRate}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6, lg: 4 }}>
            <WeekdaySalesPanel
              days={metrics.extended.weekdaySales}
              formatCurrency={formatCurrency}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: profit.enabled ? 7 : 12 }}>
            <ChartCard
              title="Monthly top performers"
              subtitle="Best customer and product each month"
            >
              <ScrollArea h={338} type="hover" offsetScrollbars>
                <Table
                  verticalSpacing="xs"
                  highlightOnHover
                  stickyHeader
                  styles={tableStyles}
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Month</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>
                        Revenue
                      </Table.Th>
                      <Table.Th>Top customer</Table.Th>
                      <Table.Th>Top product</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {metrics.monthlyTrends.map((month) => (
                      <Table.Tr key={month.month}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {month.month}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={600} c="dark.7">
                            {formatCurrency(month.revenue)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" truncate maw={180}>
                            {month.topCustomer}
                          </Text>
                          {month.topCustomerRevenue > 0 ? (
                            <Text size="xs" c="dimmed">
                              {formatCurrency(month.topCustomerRevenue)}
                            </Text>
                          ) : null}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" truncate maw={180}>
                            {month.topProduct}
                          </Text>
                          {month.topProductRevenue > 0 ? (
                            <Text size="xs" c="dimmed">
                              {formatCurrency(month.topProductRevenue)}
                            </Text>
                          ) : null}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </ChartCard>
          </Grid.Col>

          {profit.enabled ? (
            <Grid.Col span={{ base: 12, lg: 5 }}>
              <ProfitSnapshotPanel
                data={profit.data}
                isLoading={profit.isLoading}
                isError={profit.isError}
                formatCurrency={formatCurrency}
              />
            </Grid.Col>
          ) : null}

          <Grid.Col span={12}>
            <ChartCard
              title="Top products"
              subtitle={`Top 10 by sales value · ${products.length.toLocaleString('en-US')} products in catalog`}
              actions={
                isWide ? null : (
                  <SegmentedControl
                    size="xs"
                    radius="md"
                    value={productView}
                    onChange={(value) =>
                      setProductView(value as 'chart' | 'table')
                    }
                    data={[
                      { value: 'chart', label: 'Chart' },
                      { value: 'table', label: 'Table' },
                    ]}
                    aria-label="Top products view"
                  />
                )
              }
            >
              {metrics.topProducts.length === 0 ? (
                <Center h={200}>
                  <Text size="sm" c="dimmed">
                    No product sales in this period
                  </Text>
                </Center>
              ) : (
                <Grid gutter="xl">
                  {isWide || productView === 'chart' ? (
                    <Grid.Col span={isWide ? 8 : 12}>
                      <ResponsiveContainer width="100%" height={340}>
                        <BarChart
                          data={metrics.topProducts}
                          margin={CHART_MARGIN}
                        >
                          <defs>
                            <linearGradient
                              id="bi-products"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor={CHART_PALETTE.primary}
                              />
                              <stop
                                offset="100%"
                                stopColor={CHART_PALETTE.secondary}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid {...chartGridProps} />
                          <XAxis
                            dataKey="productCode"
                            {...chartAxisProps}
                            interval={0}
                            tickFormatter={(code: string) =>
                              code.length > 14 ? `${code.slice(0, 13)}…` : code
                            }
                          />
                          <YAxis
                            {...chartAxisProps}
                            width={56}
                            tickFormatter={formatCompactPeso}
                          />
                          <Tooltip
                            cursor={{ fill: 'rgba(76, 110, 245, 0.06)' }}
                            content={
                              <ChartTooltip
                                valueFormatter={formatTooltipValue}
                                extraRows={(datum) => [
                                  {
                                    label: 'Quantity',
                                    value: formatNumber(
                                      Number(datum.quantity ?? 0)
                                    ),
                                  },
                                ]}
                              />
                            }
                          />
                          <Bar
                            dataKey="totalValue"
                            name="Sales"
                            fill="url(#bi-products)"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={40}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </Grid.Col>
                  ) : null}
                  {isWide || productView === 'table' ? (
                    <Grid.Col span={isWide ? 4 : 12}>
                      <Table.ScrollContainer minWidth={360}>
                        <Table
                          verticalSpacing="xs"
                          highlightOnHover
                          styles={tableStyles}
                        >
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th w={40}>#</Table.Th>
                              <Table.Th>Product code</Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>
                                Quantity
                              </Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>
                                Sales
                              </Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {metrics.topProducts.map((product, index) => (
                              <Table.Tr key={product.productCode}>
                                <Table.Td>
                                  <Text size="sm" c="dimmed">
                                    {index + 1}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="sm" fw={500}>
                                    {product.productCode}
                                  </Text>
                                </Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>
                                  <Text size="sm">
                                    {formatNumber(product.quantity)}
                                  </Text>
                                </Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>
                                  <Text size="sm" fw={600} c="dark.7">
                                    {formatCurrency(product.totalValue)}
                                  </Text>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </Table.ScrollContainer>
                    </Grid.Col>
                  ) : null}
                </Grid>
              )}
            </ChartCard>
          </Grid.Col>
        </Grid>
      </Stack>
    </Profiler>
  );
});
