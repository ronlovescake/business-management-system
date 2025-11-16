'use client';

/**
 * Dashboard Page Component
 *
 * Main page component for Operations Dashboard module
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Grid,
  Card,
  Text,
  Title,
  Stack,
  Group,
  ThemeIcon,
  Badge,
  SimpleGrid,
  RingProgress,
  Center,
  Box,
  SegmentedControl,
  Tabs,
  Timeline,
  Progress,
  ScrollArea,
  Divider,
  ActionIcon,
  Tooltip,
  Accordion,
  Paper,
} from '@mantine/core';
import {
  IconShirt,
  IconChartBar,
  IconReceipt,
  IconTruck,
  IconPackage,
  IconAlertTriangle,
  IconClock,
  IconRefresh,
  IconArrowUpRight,
  IconArrowDownRight,
} from '@tabler/icons-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';
import type {
  NameType,
  ValueType,
} from 'recharts/types/component/DefaultTooltipContent';
import type { TooltipProps } from 'recharts';
import { PageLayout } from '@/components/layout/PageLayout';
import { useDashboardData } from '../hooks/useDashboardData';
import { FormatterService } from '@/services/FormatterService';
import type {
  TrendRange,
  OrderFunnelStage,
  InventoryAlert,
  ShipmentUpdate,
} from '../types/dashboard.types';

const trendOptions: { label: string; value: TrendRange }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

const funnelColors: Record<OrderFunnelStage['status'], string> = {
  positive: 'green',
  neutral: 'blue',
  negative: 'red',
};

const severityColors: Record<InventoryAlert['severity'], string> = {
  high: 'red',
  medium: 'orange',
  low: 'yellow',
};

const shipmentTabs: Array<{
  label: string;
  value: ShipmentUpdate['status'] | 'all';
}> = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'Pending' },
  { label: 'In Transit', value: 'In Transit' },
  { label: 'Delivered', value: 'Delivered' },
];

function TrendTooltip({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) {
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

export function DashboardPage() {
  // ==========================================================================
  // HOOKS
  // ==========================================================================

  const {
    statistics,
    todayActivity,
    monthlyGoal,
    recentActivities,
    salesTrends,
    orderFunnel,
    inventoryAlerts,
    shipmentUpdates,
    isLoading,
    error,
  } = useDashboardData();

  const [trendRange, setTrendRange] = useState<TrendRange>('30d');
  const [activeStage, setActiveStage] = useState<string>(
    orderFunnel[0]?.label ?? ''
  );
  const [shipmentFilter, setShipmentFilter] = useState<
    ShipmentUpdate['status'] | 'all'
  >('all');

  useEffect(() => {
    if (!orderFunnel.length) {
      return;
    }

    if (!orderFunnel.some((stage) => stage.label === activeStage)) {
      setActiveStage(orderFunnel[0].label);
    }
  }, [orderFunnel, activeStage]);

  useEffect(() => {
    if (!salesTrends.length) {
      return;
    }

    if (!salesTrends.some((dataset) => dataset.range === trendRange)) {
      setTrendRange(salesTrends[0].range);
    }
  }, [salesTrends, trendRange]);

  const trendDataset = useMemo(() => {
    if (!salesTrends.length) {
      return null;
    }

    return (
      salesTrends.find((dataset) => dataset.range === trendRange) ??
      salesTrends[0]
    );
  }, [salesTrends, trendRange]);

  const trendSummary = useMemo(() => {
    if (!trendDataset || trendDataset.points.length === 0) {
      return {
        totalRevenue: 0,
        avgOrders: 0,
        fulfillmentRate: 0,
      };
    }

    const totals = trendDataset.points.reduce(
      (acc, point) => {
        acc.totalRevenue += point.revenue;
        acc.totalOrders += point.orders;
        acc.fulfillmentRate += point.fulfillmentRate;
        return acc;
      },
      { totalRevenue: 0, totalOrders: 0, fulfillmentRate: 0 }
    );

    return {
      totalRevenue: totals.totalRevenue,
      avgOrders: totals.totalOrders / trendDataset.points.length,
      fulfillmentRate: Math.round(
        totals.fulfillmentRate / trendDataset.points.length
      ),
    };
  }, [trendDataset]);

  const selectedStage = useMemo(
    () => orderFunnel.find((stage) => stage.label === activeStage),
    [orderFunnel, activeStage]
  );

  const inventorySummary = useMemo(() => {
    if (!inventoryAlerts.length) {
      return { high: 0, medium: 0, low: 0 };
    }

    return inventoryAlerts.reduce(
      (acc, alert) => ({
        ...acc,
        [alert.severity]: acc[alert.severity] + 1,
      }),
      { high: 0, medium: 0, low: 0 } as Record<
        InventoryAlert['severity'],
        number
      >
    );
  }, [inventoryAlerts]);

  const filteredShipments = useMemo(() => {
    if (shipmentFilter === 'all') {
      return shipmentUpdates;
    }

    return shipmentUpdates.filter(
      (shipment) => shipment.status === shipmentFilter
    );
  }, [shipmentFilter, shipmentUpdates]);

  // ==========================================================================
  // LOADING STATE
  // ==========================================================================

  if (isLoading) {
    return (
      <PageLayout title="Operations Dashboard">
        <Stack align="center" justify="center" style={{ minHeight: '400px' }}>
          <Text>Loading dashboard data...</Text>
        </Stack>
      </PageLayout>
    );
  }

  // ==========================================================================
  // ERROR STATE
  // ==========================================================================

  if (error) {
    return (
      <PageLayout title="Operations Dashboard">
        <Stack align="center" justify="center" style={{ minHeight: '400px' }}>
          <Text c="red">Error loading dashboard: {error.message}</Text>
        </Stack>
      </PageLayout>
    );
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <PageLayout title="Operations Dashboard">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Text size="lg" fw={600}>
              Operations Control Center
            </Text>
            <Text c="dimmed" size="sm">
              Full view of revenue, fulfillment, and logistics performance.
            </Text>
          </Stack>
          <Badge size="lg" variant="light" color="pink">
            <Group gap="xs">
              <IconShirt size={14} />
              <Text>Clothing Operations</Text>
            </Group>
          </Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
          {statistics.map((stat) => (
            <Card
              key={stat.title}
              shadow="sm"
              padding="lg"
              radius="md"
              withBorder
              className="modern-card"
            >
              <Group justify="space-between">
                <Stack gap="xs">
                  <Text size="sm" c="dimmed" fw={500}>
                    {stat.title}
                  </Text>
                  <Text size="xl" fw={700}>
                    {stat.value}
                  </Text>
                  <Badge size="sm" variant="light" color={stat.color}>
                    {stat.change}
                  </Badge>
                </Stack>
                <ThemeIcon
                  size="xl"
                  radius="md"
                  variant="light"
                  color={stat.color}
                >
                  <stat.icon size={24} />
                </ThemeIcon>
              </Group>
            </Card>
          ))}
        </SimpleGrid>

        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
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
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        radius="xl"
                        size="lg"
                      >
                        <IconRefresh size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <SegmentedControl
                      data={trendOptions}
                      value={trendDataset?.range ?? trendRange}
                      onChange={(value) => setTrendRange(value as TrendRange)}
                      color="pink"
                    />
                  </Group>
                </Group>
                <Box h={280}>
                  {trendDataset ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={trendDataset.points}
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
                            <stop
                              offset="5%"
                              stopColor="#ec4899"
                              stopOpacity={0.6}
                            />
                            <stop
                              offset="95%"
                              stopColor="#ec4899"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          opacity={0.5}
                        />
                        <XAxis
                          dataKey="dateLabel"
                          tickLine={false}
                          axisLine={false}
                        />
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
                    value={FormatterService.formatCurrency(
                      trendSummary.totalRevenue
                    )}
                    description="Selected period"
                  />
                  <TrendHighlight
                    label="Avg. Orders"
                    value={FormatterService.formatNumber(
                      trendSummary.avgOrders,
                      0
                    )}
                    description="Per day"
                  />
                  <TrendHighlight
                    label="Fulfillment"
                    value={`${trendSummary.fulfillmentRate}%`}
                    description="On-time shipments"
                  />
                </SimpleGrid>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
              {monthlyGoal && (
                <Card
                  shadow="sm"
                  padding="lg"
                  radius="md"
                  withBorder
                  className="modern-card"
                >
                  <Stack gap="md" align="center">
                    <Title order={4}>Monthly Goal</Title>
                    <RingProgress
                      size={120}
                      thickness={10}
                      sections={[
                        { value: monthlyGoal.percentage, color: 'pink' },
                      ]}
                      label={
                        <Center>
                          <Text size="xl" fw={700}>
                            {monthlyGoal.percentage}%
                          </Text>
                        </Center>
                      }
                    />
                    <Stack gap={0} align="center">
                      <Text size="sm" c="dimmed">
                        Target{' '}
                        {FormatterService.formatCurrency(monthlyGoal.target)}
                      </Text>
                      <Text size="sm" c="pink" fw={600}>
                        {FormatterService.formatCurrency(monthlyGoal.current)}{' '}
                        hit
                      </Text>
                    </Stack>
                  </Stack>
                </Card>
              )}

              {todayActivity && (
                <Card
                  shadow="sm"
                  padding="lg"
                  radius="md"
                  withBorder
                  className="modern-card"
                >
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Title order={4}>Today&apos;s Activity</Title>
                      <ThemeIcon
                        size="sm"
                        variant="light"
                        color="blue"
                        radius="sm"
                      >
                        <IconClock size={14} />
                      </ThemeIcon>
                    </Group>
                    <QuickMetric
                      label="New Orders"
                      value={`+${todayActivity.newOrders}`}
                      icon={<IconReceipt size={16} />}
                      color="green"
                    />
                    <QuickMetric
                      label="Pending Shipments"
                      value={`${todayActivity.pendingShipments} routes`}
                      icon={<IconTruck size={16} />}
                      color="blue"
                    />
                    <QuickMetric
                      label="Low Stock Alerts"
                      value={`${todayActivity.lowStockItems} items`}
                      icon={<IconPackage size={16} />}
                      color="orange"
                    />
                  </Stack>
                </Card>
              )}
            </Stack>
          </Grid.Col>
        </Grid>

        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
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
                    <Title order={4}>Order Pipeline</Title>
                    <Text c="dimmed" size="sm">
                      Tap a stage to inspect throughput.
                    </Text>
                  </div>
                  <Badge variant="light" color="blue">
                    {orderFunnel.length} stages
                  </Badge>
                </Group>
                <Group gap="xs" wrap="wrap">
                  {orderFunnel.map((stage) => (
                    <Card
                      key={stage.label}
                      padding="sm"
                      radius="md"
                      withBorder
                      onClick={() => setActiveStage(stage.label)}
                      className={
                        stage.label === activeStage
                          ? 'modern-card active'
                          : 'modern-card'
                      }
                      style={{ cursor: 'pointer', minWidth: '120px' }}
                    >
                      <Stack gap={2}>
                        <Text size="sm" fw={600}>
                          {stage.label}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {stage.value} orders
                        </Text>
                      </Stack>
                    </Card>
                  ))}
                </Group>
                {selectedStage && (
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text fw={600}>{selectedStage.label}</Text>
                      <Group gap={4}>
                        <ThemeIcon
                          size="sm"
                          variant="light"
                          color={funnelColors[selectedStage.status]}
                          radius="sm"
                        >
                          {selectedStage.delta >= 0 ? (
                            <IconArrowUpRight size={14} />
                          ) : (
                            <IconArrowDownRight size={14} />
                          )}
                        </ThemeIcon>
                        <Text
                          size="sm"
                          fw={600}
                          color={selectedStage.delta >= 0 ? 'green' : 'red'}
                        >
                          {selectedStage.delta >= 0 ? '+' : ''}
                          {selectedStage.delta}% vs last week
                        </Text>
                      </Group>
                    </Group>
                    <Progress
                      value={Math.min(
                        100,
                        (selectedStage.value /
                          (orderFunnel[0]?.value || selectedStage.value)) *
                          100
                      )}
                      color={funnelColors[selectedStage.status]}
                      size="xl"
                      radius="lg"
                    />
                    <Text size="sm" c="dimmed">
                      Keeping this stage flowing unlocks faster cash collection
                      downstream.
                    </Text>
                  </Stack>
                )}
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
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
                    <Title order={4}>Shipment Timeline</Title>
                    <Text c="dimmed" size="sm">
                      Monitor high-value routes in one place.
                    </Text>
                  </div>
                  <Tabs
                    value={shipmentFilter}
                    onChange={(value) =>
                      setShipmentFilter(
                        value as ShipmentUpdate['status'] | 'all'
                      )
                    }
                    radius="md"
                  >
                    <Tabs.List>
                      {shipmentTabs.map((tab) => (
                        <Tabs.Tab value={tab.value} key={tab.value}>
                          {tab.label}
                        </Tabs.Tab>
                      ))}
                    </Tabs.List>
                  </Tabs>
                </Group>
                <ScrollArea h={230} offsetScrollbars>
                  <Timeline
                    active={filteredShipments.length}
                    bulletSize={24}
                    lineWidth={2}
                    color="pink"
                  >
                    {filteredShipments.map((shipment) => (
                      <Timeline.Item
                        key={shipment.shipmentCode}
                        bullet={
                          <ThemeIcon
                            size={24}
                            radius="xl"
                            color="pink"
                            variant="light"
                          >
                            <IconTruck size={14} />
                          </ThemeIcon>
                        }
                        title={shipment.shipmentCode}
                      >
                        <Text size="sm" fw={500}>
                          {shipment.status}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {shipment.location} • {shipment.timestamp}
                        </Text>
                        <Progress
                          value={shipment.progress}
                          mt="xs"
                          color="pink"
                          size="lg"
                          radius="lg"
                        />
                      </Timeline.Item>
                    ))}
                    {filteredShipments.length === 0 && (
                      <Timeline.Item title="No shipments" lineVariant="dashed">
                        <Text size="sm" c="dimmed">
                          No shipments in this status right now.
                        </Text>
                      </Timeline.Item>
                    )}
                  </Timeline>
                </ScrollArea>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
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
                    <Title order={4}>Inventory Health</Title>
                    <Text size="sm" c="dimmed">
                      {inventoryAlerts.length} flagged SKUs • stay ahead of
                      stock-outs.
                    </Text>
                  </div>
                  <Group gap="xs">
                    {(
                      Object.keys(inventorySummary) as Array<
                        InventoryAlert['severity']
                      >
                    ).map((level) => (
                      <Badge
                        key={level}
                        color={severityColors[level]}
                        variant="light"
                      >
                        {level.toUpperCase()} {inventorySummary[level]}
                      </Badge>
                    ))}
                  </Group>
                </Group>
                <Accordion
                  radius="md"
                  variant="separated"
                  chevronPosition="right"
                >
                  {inventoryAlerts.map((alert) => (
                    <Accordion.Item
                      key={alert.productCode}
                      value={alert.productCode}
                    >
                      <Accordion.Control>
                        <Group gap="sm" align="center">
                          <ThemeIcon
                            radius="md"
                            size="sm"
                            color={severityColors[alert.severity]}
                            variant="light"
                          >
                            <IconAlertTriangle size={14} />
                          </ThemeIcon>
                          <div>
                            <Text fw={600} size="sm">
                              {alert.productCode}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {alert.description}
                            </Text>
                          </div>
                        </Group>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="xs">
                          <Group justify="space-between" gap="md">
                            <Text size="sm">Stock Level</Text>
                            <Text size="sm" fw={600}>
                              {alert.stockLevel} units
                            </Text>
                          </Group>
                          <Progress
                            value={Math.min(
                              100,
                              (alert.stockLevel / alert.reorderPoint) * 100
                            )}
                            color={severityColors[alert.severity]}
                            radius="lg"
                          />
                          <Text size="xs" c="dimmed">
                            Reorder point at {alert.reorderPoint} units.
                            {alert.etaDays && ` ETA ${alert.etaDays} days`}
                          </Text>
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  ))}
                </Accordion>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
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
                    <Title order={4}>Recent Activity</Title>
                    <Text size="sm" c="dimmed">
                      Timeline across orders, inventory, and comms.
                    </Text>
                  </div>
                  <Badge variant="light" color="violet">
                    Live feed
                  </Badge>
                </Group>
                <Divider />
                <ScrollArea h={260} offsetScrollbars>
                  <Stack gap="sm">
                    {recentActivities.map((activity) => (
                      <Card
                        key={`${activity.time}-${activity.action}`}
                        padding="md"
                        radius="md"
                        withBorder
                        className="modern-card"
                      >
                        <Group justify="space-between">
                          <Group gap="sm">
                            <ThemeIcon
                              size="sm"
                              radius="md"
                              variant="light"
                              color={activity.color}
                            >
                              <IconShirt size={12} />
                            </ThemeIcon>
                            <Text size="sm">{activity.action}</Text>
                          </Group>
                          <Text size="xs" c="dimmed">
                            {activity.time}
                          </Text>
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                </ScrollArea>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </PageLayout>
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

interface QuickMetricProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

function QuickMetric({ label, value, icon, color }: QuickMetricProps) {
  return (
    <Group justify="space-between">
      <Group gap="sm">
        <ThemeIcon size="sm" radius="sm" variant="light" color={color}>
          {icon}
        </ThemeIcon>
        <Text size="sm">{label}</Text>
      </Group>
      <Text size="xs" c="dimmed">
        {value}
      </Text>
    </Group>
  );
}
