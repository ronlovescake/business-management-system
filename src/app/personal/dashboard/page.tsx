'use client';

import {
  Alert,
  Anchor,
  Badge,
  Button,
  Center,
  Grid,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconCalendar, IconRefresh } from '@tabler/icons-react';
import { ChartCard } from '@/components/charts/ChartCard';
import { DonutChart } from '@/components/charts/DonutChart';
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { KpiCard } from '@/components/charts/KpiCard';
import { RankedBarChart } from '@/components/charts/RankedBarChart';
import { TrendAreaChart } from '@/components/charts/TrendAreaChart';
import {
  CHART_SERIES_COLORS,
  formatCompactPeso,
} from '@/components/charts/chartTheme';
import { PersonalPageShell } from '../components/PersonalPageShell';
import { usePersonalDashboard } from './hooks/usePersonalDashboard';
import { PersonalBudgetComparisonChart } from './components/PersonalBudgetComparisonChart';
import type { HouseholdUpcomingBill } from '@/modules/household/dashboard/api';
import { formatDateOnlyPreservingInput } from '@/utils/dateFormatters';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(value || 0);

const tableStyles = {
  th: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
    color: 'var(--mantine-color-dimmed)',
  },
};

function EmptyState({
  children,
  href,
  linkLabel,
}: {
  children: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <Center mih={210}>
      <Stack align="center" gap={6}>
        <Text size="sm" c="dimmed" ta="center">
          {children}
        </Text>
        <Anchor href={href} size="sm">
          {linkLabel}
        </Anchor>
      </Stack>
    </Center>
  );
}

function billStatusColor(status: HouseholdUpcomingBill['status']): string {
  if (status === 'paid') {
    return 'teal';
  }
  if (status === 'approved') {
    return 'blue';
  }
  if (status === 'pending') {
    return 'orange';
  }
  return 'gray';
}

export default function PersonalDashboardPage() {
  const {
    range,
    setRange,
    rangeOptions,
    summary,
    isLoading,
    isFetching,
    error,
    refetch,
  } = usePersonalDashboard();

  if (isLoading && !summary) {
    return (
      <PersonalPageShell
        title="Personal Dashboard"
        description="Household finances, cash flow, and upcoming bills."
      >
        <Center mih={320}>
          <Loader aria-label="Loading personal dashboard" />
        </Center>
      </PersonalPageShell>
    );
  }

  const savingsRateDelta =
    summary?.kpis.savingsRate !== null &&
    summary?.kpis.savingsRate !== undefined &&
    summary.kpis.previousSavingsRate !== null
      ? summary.kpis.savingsRate - summary.kpis.previousSavingsRate
      : null;

  return (
    <PersonalPageShell
      title="Personal Dashboard"
      description="Household finances, cash flow, and upcoming bills."
    >
      <Stack gap="md">
        <Group justify="flex-end" align="flex-end" gap="xs" wrap="wrap">
          <Select
            aria-label="Dashboard date range"
            leftSection={<IconCalendar size={16} />}
            data={rangeOptions}
            value={range}
            onChange={(value) => {
              if (value) {
                setRange(value as typeof range);
              }
            }}
            w={{ base: '100%', xs: 210 }}
            allowDeselect={false}
          />
          <Button
            aria-label="Refresh dashboard"
            title="Refresh dashboard"
            variant="default"
            leftSection={<IconRefresh size={16} />}
            loading={isFetching}
            onClick={() => void refetch()}
          >
            Refresh
          </Button>
        </Group>

        {error ? (
          <Alert color="red" title="Dashboard data could not be loaded">
            {error instanceof Error ? error.message : 'Please try again.'}
          </Alert>
        ) : null}

        {summary ? (
          <>
            <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 6 }} spacing="sm">
              <KpiCard
                label="Net worth"
                value={formatCurrency(summary.kpis.netWorth)}
                caption="Active assets less debt"
              />
              <KpiCard
                label="Income"
                value={formatCurrency(summary.kpis.income)}
                delta={summary.kpis.incomeDelta}
                deltaCaption="vs previous period"
              />
              <KpiCard
                label="Expenses"
                value={formatCurrency(summary.kpis.expenses)}
                delta={summary.kpis.expensesDelta}
                deltaPositiveIsGood={false}
                deltaCaption="vs previous period"
              />
              <KpiCard
                label="Net cash flow"
                value={formatCurrency(summary.kpis.netCashFlow)}
                delta={summary.kpis.netCashFlowDelta}
                deltaCaption="vs previous period"
              />
              <KpiCard
                label="Savings rate"
                value={
                  summary.kpis.savingsRate === null
                    ? '—'
                    : `${summary.kpis.savingsRate.toFixed(1)}%`
                }
                delta={savingsRateDelta}
                deltaCaption="percentage points vs prior period"
              />
              <KpiCard
                label="Bills due soon"
                value={formatCurrency(summary.kpis.upcomingBillsTotal)}
                caption={`${summary.kpis.upcomingBillsCount} unpaid in the next 30 days`}
                deltaPositiveIsGood={false}
              />
            </SimpleGrid>

            <Grid gutter="md">
              <Grid.Col span={12}>
                <ChartCard
                  title="Income and expenses"
                  subtitle="Household cash flow for the selected period"
                >
                  {summary.trend.some(
                    (point) => point.income || point.expenses
                  ) ? (
                    <TrendAreaChart
                      data={summary.trend}
                      xKey="label"
                      height={310}
                      series={[
                        {
                          dataKey: 'income',
                          name: 'Income',
                          color: '#20c997',
                        },
                        {
                          dataKey: 'expenses',
                          name: 'Expenses',
                          color: CHART_SERIES_COLORS[1],
                        },
                      ]}
                      valueFormatter={(value) => formatCurrency(value)}
                    />
                  ) : (
                    <EmptyState href="/personal/income" linkLabel="Add income">
                      No income or expenses in this period.
                    </EmptyState>
                  )}
                </ChartCard>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <ChartCard
                  title="Spending by category"
                  subtitle="Rejected expenses are excluded"
                >
                  {summary.categories.length ? (
                    <DonutChart
                      data={summary.categories.map((item, index) => ({
                        name: item.category,
                        value: item.amount,
                        color:
                          CHART_SERIES_COLORS[
                            index % CHART_SERIES_COLORS.length
                          ],
                      }))}
                      centerLabel="Total spent"
                      centerValue={formatCompactPeso(summary.kpis.expenses)}
                      valueFormatter={formatCurrency}
                    />
                  ) : (
                    <EmptyState
                      href="/personal/expenses"
                      linkLabel="Record an expense"
                    >
                      No expenses in this period.
                    </EmptyState>
                  )}
                </ChartCard>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <ChartCard
                  title="Budget vs actual"
                  subtitle={`Monthly average compared with ${summary.budgetMonthLabel}`}
                >
                  {summary.budgets.length ? (
                    <PersonalBudgetComparisonChart data={summary.budgets} />
                  ) : (
                    <EmptyState
                      href="/personal/expenses"
                      linkLabel="Record an expense"
                    >
                      Add expenses to establish category averages.
                    </EmptyState>
                  )}
                </ChartCard>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <ChartCard
                  title="Account balances"
                  subtitle="Liability balances reduce net worth"
                >
                  {summary.accounts.length ? (
                    <HorizontalBarChart
                      data={summary.accounts.map((account) => ({
                        name: account.name,
                        value: account.balance,
                      }))}
                      height={Math.max(180, summary.accounts.length * 38)}
                      labelWidth={118}
                      valueFormatter={formatCurrency}
                    />
                  ) : (
                    <EmptyState
                      href="/personal/accounts"
                      linkLabel="Add an account"
                    >
                      Add accounts to see balances and net worth.
                    </EmptyState>
                  )}
                </ChartCard>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <ChartCard
                  title="Upcoming bills"
                  subtitle="Active recurring payments due in the next 30 days"
                >
                  {summary.upcomingBills.length ? (
                    <Table.ScrollContainer minWidth={480}>
                      <Table verticalSpacing="sm" styles={tableStyles}>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Due</Table.Th>
                            <Table.Th>Bill</Table.Th>
                            <Table.Th>Account</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>
                              Amount
                            </Table.Th>
                            <Table.Th>Status</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {summary.upcomingBills.map((bill) => (
                            <Table.Tr key={`${bill.id}-${bill.dueDate}`}>
                              <Table.Td>
                                {formatDateOnlyPreservingInput(bill.dueDate)}
                              </Table.Td>
                              <Table.Td>
                                <Stack gap={0}>
                                  <Text size="sm" fw={500}>
                                    {bill.name}
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    {bill.category}
                                  </Text>
                                </Stack>
                              </Table.Td>
                              <Table.Td>{bill.accountName ?? '—'}</Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                {formatCurrency(bill.amount)}
                              </Table.Td>
                              <Table.Td>
                                <Badge
                                  size="sm"
                                  variant="light"
                                  color={billStatusColor(bill.status)}
                                >
                                  {bill.status}
                                </Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  ) : (
                    <EmptyState
                      href="/personal/expenses"
                      linkLabel="Manage recurring payments"
                    >
                      No recurring bills are due in the next 30 days.
                    </EmptyState>
                  )}
                </ChartCard>
              </Grid.Col>

              <Grid.Col span={12}>
                <ChartCard
                  title="Spending by weekday"
                  subtitle="Number of expenses and spending amount by day"
                >
                  {summary.weekday.some((day) => day.count > 0) ? (
                    <RankedBarChart
                      data={summary.weekday}
                      labelKey="day"
                      valueKey="amount"
                      seriesName="Spending"
                      valueFormatter={formatCurrency}
                      extraRows={(datum) => [
                        {
                          label: 'Expenses',
                          value: String(datum.count ?? 0),
                        },
                      ]}
                      height={260}
                    />
                  ) : (
                    <EmptyState
                      href="/personal/expenses"
                      linkLabel="Record an expense"
                    >
                      No expenses in this period.
                    </EmptyState>
                  )}
                </ChartCard>
              </Grid.Col>
            </Grid>
          </>
        ) : null}
      </Stack>
    </PersonalPageShell>
  );
}
