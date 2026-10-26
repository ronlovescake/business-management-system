'use client';

import Link from 'next/link';
import {
  Badge,
  Center,
  Grid,
  Group,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBuildingBank,
  IconCalendar,
  IconChartBar,
  IconChevronRight,
  IconClipboardList,
  IconCurrencyPeso,
  IconReceipt,
  IconUsersGroup,
} from '@tabler/icons-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { ChartCard } from '@/components/charts/ChartCard';
import { KpiCard } from '@/components/charts/KpiCard';
import { LegendDot } from '@/components/charts/LegendDot';
import { TrendAreaChart } from '@/components/charts/TrendAreaChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { RankedBarChart } from '@/components/charts/RankedBarChart';
import {
  CHART_PALETTE,
  formatCompactPeso,
} from '@/components/charts/chartTheme';
import { ChartSkeleton } from '@/components/ui/ChartSkeleton';
import { PERIOD_OPTIONS, type PeriodOption } from '@/lib/accounting/constants';
import {
  formatCurrencyPHP,
  formatLongDateUS,
} from '@/lib/accounting/formatters';
import { AccountingLoadErrorAlert } from '@/app/accounting/_shared/AccountingLoadErrorAlert';
import { useAccountingDashboard } from '@/app/accounting/_shared/dashboard/useAccountingDashboard';
import { RefundPending } from '@/components/refunds/RefundPending';
import { InventoryValuationNotice } from '@/components/accounting/InventoryValuationNotice';
import { getCurrentDateISO, toISODate } from '@/utils/date';
import { getPeriodRange } from '@/lib/accounting/date-utils';

type AccountingDashboardRoutePageProps = {
  businessPathPrefix: '/clothing' | '/general-merchandise';
  apiBasePath?: string;
  showExpensesLink?: boolean;
  showInvestorsLink?: boolean;
};

const POSITIVE_COLOR = '#20c997';
const NEGATIVE_COLOR = '#ff8787';

const tableStyles = {
  th: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
    color: 'var(--mantine-color-dimmed)',
  },
};

const formatCurrency = (value: number) => formatCurrencyPHP(value);
const formatPercent = (value: number | null) =>
  value === null ? '—' : `${value.toFixed(1)}%`;

function EmptyState({ height, message }: { height: number; message: string }) {
  return (
    <Center h={height}>
      <Text size="sm" c="dimmed">
        {message}
      </Text>
    </Center>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text
        fw={600}
        c={
          tone === 'negative'
            ? 'red.7'
            : tone === 'positive'
              ? 'teal.7'
              : 'dark.7'
        }
      >
        {value}
      </Text>
    </div>
  );
}

type QuickLink = {
  label: string;
  description: string;
  href: string;
  icon: typeof IconReceipt;
};

function QuickLinkCard({ link }: { link: QuickLink }) {
  const Icon = link.icon;
  return (
    <Paper
      component={Link}
      href={link.href}
      radius="md"
      p="sm"
      withBorder
      style={{
        borderColor: 'var(--mantine-color-gray-2)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Group wrap="nowrap" gap="sm">
        <ThemeIcon variant="light" color="indigo" radius="md" size={36}>
          <Icon size={18} />
        </ThemeIcon>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={600} c="dark.7">
            {link.label}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {link.description}
          </Text>
        </div>
        <IconChevronRight size={16} color="var(--mantine-color-gray-5)" />
      </Group>
    </Paper>
  );
}

export function AccountingDashboardRoutePage({
  businessPathPrefix,
  apiBasePath,
  showExpensesLink = false,
  showInvestorsLink = false,
}: AccountingDashboardRoutePageProps) {
  const {
    period,
    setPeriod,
    periodLabel,
    asOf,
    hasComparison,
    snapshot,
    valuation,
    deltas,
    monthlyTrend,
    expenseSlices,
    balanceStats,
    balanceSummary,
    loadError,
    isLoading,
  } = useAccountingDashboard(apiBasePath);

  const basePath = `${businessPathPrefix}/accounting`;
  const asOfLabel = formatLongDateUS(asOf);
  const refundPeriod = getPeriodRange(period);
  const refundAsOf = asOf > getCurrentDateISO() ? getCurrentDateISO() : asOf;
  const quickLinks: QuickLink[] = [
    ...(showExpensesLink
      ? [
          {
            label: 'Expenses',
            description: 'Record and approve expenses',
            href: `${basePath}/expenses`,
            icon: IconReceipt,
          },
        ]
      : []),
    {
      label: 'Journal',
      description: 'All entries with source traceability',
      href: `${basePath}/journal`,
      icon: IconClipboardList,
    },
    {
      label: 'Ledger',
      description: 'Postings grouped by account',
      href: `${basePath}/ledger`,
      icon: IconChartBar,
    },
    {
      label: 'Profit & Loss',
      description: 'Revenue, costs and breakdowns',
      href: `${basePath}/profit-loss`,
      icon: IconCurrencyPeso,
    },
    {
      label: 'Balance Sheet',
      description: 'Assets, liabilities and equity',
      href: `${basePath}/balance-sheet`,
      icon: IconBuildingBank,
    },
    ...(showInvestorsLink
      ? [
          {
            label: 'Investors',
            description: 'Statements and return schedules',
            href: `${basePath}/investors`,
            icon: IconUsersGroup,
          },
        ]
      : []),
  ];

  const deltaCaption = hasComparison ? 'vs previous period' : undefined;
  const isBalanced = balanceStats
    ? Math.abs(balanceStats.balance) < 0.01
    : true;
  const trendHasData = monthlyTrend.some(
    (point) =>
      point.revenue !== 0 || point.cogs !== 0 || point.operatingExpenses !== 0
  );
  const totalOperatingExpenses = expenseSlices.reduce(
    (sum, slice) => sum + slice.value,
    0
  );

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <div>
            <Title order={2} fw={700} c="dark.8">
              Accounting overview
            </Title>
            <Text size="sm" c="dimmed">
              {periodLabel} · Balance sheet as of {asOfLabel}
            </Text>
          </div>
          <Select
            data={PERIOD_OPTIONS.map((option) => ({
              value: option,
              label: option === 'This Year' ? 'Year to date' : option,
            }))}
            value={period}
            onChange={(value) =>
              setPeriod((value as PeriodOption | null) ?? 'This Year')
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

        <AccountingLoadErrorAlert message={loadError} />
        <InventoryValuationNotice valuation={valuation} />
        {businessPathPrefix === '/clothing' && (
          <RefundPending
            asOf={refundAsOf}
            from={refundPeriod.from ? toISODate(refundPeriod.from) : undefined}
            showPaid
          />
        )}

        <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 6 }} spacing="md">
          {isLoading.profitLoss ? (
            Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} h={104} radius="md" />
            ))
          ) : snapshot ? (
            <>
              <KpiCard
                label="Revenue"
                value={formatCurrency(snapshot.revenue)}
                delta={deltas.revenue}
                deltaCaption={deltaCaption}
                caption="Net of returns"
              />
              <KpiCard
                label="Gross profit"
                value={formatCurrency(snapshot.grossProfit)}
                delta={deltas.grossProfit}
                deltaCaption={deltaCaption}
                caption="Revenue less COGS"
              />
              <KpiCard
                label="Net profit"
                value={formatCurrency(snapshot.netProfit)}
                delta={deltas.netProfit}
                deltaCaption={deltaCaption}
                caption="After all expenses"
              />
              <KpiCard
                label="Gross margin"
                value={formatPercent(snapshot.grossMargin)}
                caption={`Net margin ${formatPercent(snapshot.netMargin)}`}
              />
              <KpiCard
                label="Operating expenses"
                value={formatCurrency(snapshot.operatingExpenses)}
                delta={deltas.operatingExpenses}
                deltaCaption={deltaCaption}
                caption="Excludes COGS"
              />
            </>
          ) : null}
          {isLoading.balanceSheet ? (
            <Skeleton h={104} radius="md" />
          ) : (
            <KpiCard
              label="Cash"
              value={formatCurrency(balanceSummary.cashOnHand)}
              badge="Balance"
              caption={`As of ${asOfLabel}`}
            />
          )}
        </SimpleGrid>

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, xl: 8 }}>
            <ChartCard
              title="Profit & loss trend"
              subtitle="Monthly, last 12 months"
              actions={
                <Group gap="md" visibleFrom="sm">
                  <LegendDot color={CHART_PALETTE.primary} label="Revenue" />
                  <LegendDot color={CHART_PALETTE.secondary} label="COGS" />
                  <LegendDot color={CHART_PALETTE.tertiary} label="Expenses" />
                  <LegendDot color={POSITIVE_COLOR} label="Net profit" />
                </Group>
              }
            >
              {isLoading.trend ? (
                <ChartSkeleton type="area" height={300} hasTitle={false} />
              ) : trendHasData ? (
                <TrendAreaChart
                  data={monthlyTrend}
                  xKey="month"
                  valueFormatter={(value) => formatCurrency(value)}
                  series={[
                    {
                      dataKey: 'operatingExpenses',
                      name: 'Expenses',
                      color: CHART_PALETTE.tertiary,
                    },
                    {
                      dataKey: 'cogs',
                      name: 'COGS',
                      color: CHART_PALETTE.secondary,
                    },
                    {
                      dataKey: 'revenue',
                      name: 'Revenue',
                      color: CHART_PALETTE.primary,
                      strokeWidth: 2.5,
                    },
                    {
                      dataKey: 'netProfit',
                      name: 'Net profit',
                      color: POSITIVE_COLOR,
                      strokeWidth: 2.5,
                    },
                  ]}
                />
              ) : (
                <EmptyState
                  height={300}
                  message="No postings in the last 12 months"
                />
              )}
            </ChartCard>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6, xl: 4 }}>
            <ChartCard
              title="Operating expenses"
              subtitle="By category, selected period"
            >
              {isLoading.profitLoss ? (
                <ChartSkeleton type="donut" height={300} hasTitle={false} />
              ) : expenseSlices.length === 0 ? (
                <EmptyState height={300} message="No expenses in this period" />
              ) : (
                <DonutChart
                  data={expenseSlices}
                  centerLabel="Total"
                  centerValue={formatCompactPeso(totalOperatingExpenses)}
                  valueFormatter={formatCurrency}
                  labelHeader="Category"
                />
              )}
            </ChartCard>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6, xl: 4 }}>
            <ChartCard
              title="Profit snapshot"
              subtitle="Selected period"
              actions={
                snapshot && snapshot.grossMargin !== null ? (
                  <Badge variant="light" color="indigo" radius="sm">
                    {`${snapshot.grossMargin.toFixed(1)}% gross margin`}
                  </Badge>
                ) : null
              }
            >
              {isLoading.profitLoss ? (
                <ChartSkeleton type="bar" height={260} hasTitle={false} />
              ) : !snapshot ? (
                <EmptyState height={260} message="Profit data is unavailable" />
              ) : (
                <>
                  <SimpleGrid
                    cols={2}
                    spacing="md"
                    verticalSpacing="sm"
                    mb="md"
                  >
                    <Figure
                      label="Revenue"
                      value={formatCurrency(snapshot.revenue)}
                    />
                    <Figure
                      label="COGS"
                      value={formatCurrency(snapshot.cogs)}
                    />
                    <Figure
                      label="Operating expenses"
                      value={formatCurrency(snapshot.operatingExpenses)}
                    />
                    <Figure
                      label="Net profit"
                      value={formatCurrency(snapshot.netProfit)}
                      tone={snapshot.netProfit < 0 ? 'negative' : 'positive'}
                    />
                  </SimpleGrid>
                  <HorizontalBarChart
                    valueFormatter={formatCurrency}
                    data={[
                      {
                        name: 'Revenue',
                        value: snapshot.revenue,
                        color: CHART_PALETTE.primary,
                      },
                      {
                        name: 'COGS',
                        value: snapshot.cogs,
                        color: CHART_PALETTE.secondary,
                      },
                      {
                        name: 'Expenses',
                        value: snapshot.operatingExpenses,
                        color: CHART_PALETTE.tertiary,
                      },
                      {
                        name: 'Net profit',
                        value: snapshot.netProfit,
                        color:
                          snapshot.netProfit < 0
                            ? NEGATIVE_COLOR
                            : POSITIVE_COLOR,
                      },
                    ]}
                  />
                </>
              )}
            </ChartCard>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6, xl: 4 }}>
            <ChartCard
              title="Balance sheet"
              subtitle={`As of ${asOfLabel}`}
              actions={
                balanceStats ? (
                  <Badge
                    variant="light"
                    color={isBalanced ? 'teal' : 'red'}
                    radius="sm"
                  >
                    {isBalanced
                      ? 'Balanced'
                      : `Off by ${formatCurrency(balanceStats.balance)}`}
                  </Badge>
                ) : null
              }
            >
              {isLoading.balanceSheet ? (
                <ChartSkeleton type="bar" height={260} hasTitle={false} />
              ) : !balanceStats ? (
                <EmptyState
                  height={260}
                  message="Balance sheet is unavailable"
                />
              ) : (
                <>
                  <SimpleGrid cols={3} spacing="xs" mb="md">
                    <Figure
                      label="Assets"
                      value={formatCompactPeso(balanceStats.assets)}
                    />
                    <Figure
                      label="Liabilities"
                      value={formatCompactPeso(balanceStats.liabilities)}
                    />
                    <Figure
                      label="Equity"
                      value={formatCompactPeso(balanceStats.equity)}
                    />
                  </SimpleGrid>
                  <HorizontalBarChart
                    height={150}
                    valueFormatter={formatCurrency}
                    data={[
                      {
                        name: 'Assets',
                        value: balanceStats.assets,
                        color: CHART_PALETTE.primary,
                      },
                      {
                        name: 'Liabilities',
                        value: balanceStats.liabilities,
                        color: CHART_PALETTE.secondary,
                      },
                      {
                        name: 'Equity',
                        value: balanceStats.equity,
                        color: CHART_PALETTE.tertiary,
                      },
                    ]}
                  />
                </>
              )}
            </ChartCard>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6, xl: 4 }}>
            <ChartCard
              title="Top asset accounts"
              subtitle={`As of ${asOfLabel}`}
            >
              {isLoading.balanceSheet ? (
                <ChartSkeleton type="bar" height={260} hasTitle={false} />
              ) : balanceSummary.topAssets.length === 0 ? (
                <EmptyState height={260} message="No asset balances yet" />
              ) : (
                <RankedBarChart
                  data={balanceSummary.topAssets}
                  labelKey="account"
                  valueKey="amount"
                  seriesName="Balance"
                  valueFormatter={formatCurrency}
                  height={260}
                  maxLabelLength={10}
                />
              )}
            </ChartCard>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 8 }}>
            <ChartCard
              title="Monthly summary"
              subtitle="Last 12 months, newest first"
            >
              {isLoading.trend ? (
                <Skeleton h={320} radius="md" />
              ) : (
                <ScrollArea h={320} type="hover" offsetScrollbars>
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
                        <Table.Th style={{ textAlign: 'right' }}>COGS</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>
                          Expenses
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>
                          Net profit
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>
                          Margin
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {[...monthlyTrend].reverse().map((point) => (
                        <Table.Tr key={point.key}>
                          <Table.Td>
                            <Text size="sm" fw={500}>
                              {point.month}
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="sm" fw={600} c="dark.7">
                              {formatCurrency(point.revenue)}
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="sm">{formatCurrency(point.cogs)}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="sm">
                              {formatCurrency(point.operatingExpenses)}
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text
                              size="sm"
                              fw={600}
                              c={point.netProfit < 0 ? 'red.7' : 'teal.7'}
                            >
                              {formatCurrency(point.netProfit)}
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="sm" c="dimmed">
                              {formatPercent(
                                point.revenue !== 0
                                  ? (point.netProfit / point.revenue) * 100
                                  : null
                              )}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </ChartCard>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <ChartCard title="Go to" subtitle="Detailed accounting views">
              <Stack gap="xs">
                {quickLinks.map((link) => (
                  <QuickLinkCard key={link.href} link={link} />
                ))}
              </Stack>
            </ChartCard>
          </Grid.Col>
        </Grid>
      </Stack>
    </PageLayout>
  );
}
