'use client';

import { useMemo } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import {
  DatePickerInput,
  MonthPickerInput,
  YearPickerInput,
} from '@mantine/dates';
import {
  IconAlertCircle,
  IconCalendarStats,
  IconCash,
  IconChartBar,
  IconChartPie,
  IconGiftCard,
  IconReceipt2,
  IconRefresh,
  IconReportMoney,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageLayout } from '@/components/layout/PageLayout';
import { StatsCardGrid } from '@/components/ui';
import { ChartEmptyState } from './ChartEmptyState';
import { DashboardErrorBoundary } from './DashboardErrorBoundary';
import { useEmployeeDashboard } from '../hooks/useEmployeeDashboard';
import type { DashboardViewMode } from '../types';
import { FormatterService } from '@/services/FormatterService';

const STATUS_COLOR_MAP: Record<string, string> = {
  present: 'green',
  late: 'yellow',
  absent: 'red',
  'on-leave': 'grape',
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
  paid: 'teal',
  settled: 'blue',
  released: 'cyan',
  processed: 'indigo',
  cancelled: 'gray',
};

const CHART_COLORS = [
  '#4C6EF5',
  '#2F9E44',
  '#845EF7',
  '#F59F00',
  '#0CA678',
  '#E64980',
];

const viewOptions = [
  { label: 'Daily', value: 'day' },
  { label: 'Monthly', value: 'month' },
  { label: 'Yearly', value: 'year' },
];

function formatStatusLabel(status: string): string {
  const normalized = status.replace(/[-_]/g, ' ');
  return FormatterService.titleCase(normalized);
}

function getStatusColor(status: string): string {
  return STATUS_COLOR_MAP[status.toLowerCase()] || 'gray';
}

function getStatusChartColor(status: string): string {
  const color = STATUS_COLOR_MAP[status.toLowerCase()];
  return color ? `var(--mantine-color-${color}-6)` : '#adb5bd';
}

function DashboardContent() {
  const {
    data,
    loading,
    error,
    viewMode,
    rangeLabel,
    range,
    actions,
    selections,
  } = useEmployeeDashboard();

  const statsCards = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      {
        title: 'Attendance Records',
        value: FormatterService.formatNumber(data.attendance.totalRecords, 0),
        icon: <IconUsersGroup size={20} />,
        color: 'blue',
        backgroundColor: 'var(--mantine-color-blue-6)',
      },
      {
        title: 'Expenses',
        value: FormatterService.formatCurrency(data.expenses.totalAmount),
        icon: <IconReceipt2 size={20} />,
        color: 'teal',
        backgroundColor: 'var(--mantine-color-teal-6)',
      },
      {
        title: 'Payroll Net Pay',
        value: FormatterService.formatCurrency(data.payroll.totalNet),
        icon: <IconCash size={20} />,
        color: 'violet',
        backgroundColor: 'var(--mantine-color-violet-6)',
      },
      {
        title: 'Cash Advance Requests',
        value: FormatterService.formatNumber(data.cashAdvance.totalRecords, 0),
        icon: <IconReportMoney size={20} />,
        color: 'orange',
        backgroundColor: 'var(--mantine-color-orange-6)',
      },
    ];
  }, [data]);

  const attendanceChartData = useMemo(() => {
    if (!data) {
      return [];
    }

    return Object.entries(data.attendance.statusCounts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        status,
        label: formatStatusLabel(status),
        value: count,
      }));
  }, [data]);

  const expensesChartData = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.expenses.categories
      .filter((category) => (category.amount || 0) > 0)
      .slice(0, 6)
      .map((category, index) => ({
        label: category.category,
        value: Number(category.amount || 0),
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));
  }, [data]);

  const payrollComparisonData = useMemo(() => {
    if (!data) {
      return [];
    }

    const rows = [
      { label: 'Payroll Net', value: data.payroll.totalNet },
      { label: 'Expenses', value: data.expenses.totalAmount },
      { label: 'Cash Advance', value: data.cashAdvance.totalRequested },
      { label: '13th Month Paid', value: data.thirteenthMonth.totalPaid },
    ];

    return rows
      .filter((row) => row.value > 0)
      .map((row, index) => ({
        ...row,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));
  }, [data]);

  const departmentChartData = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.team.departments
      .filter((dept) => dept.count > 0)
      .slice(0, 6)
      .map((dept, index) => ({
        label: dept.name,
        value: dept.count,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));
  }, [data]);

  const isInitialLoading = loading && !data;
  const shouldDimContent = loading && !!data;

  const renderStatusBadges = (counts: Record<string, number>) => {
    const entries = Object.entries(counts).filter(([, value]) => value > 0);

    if (entries.length === 0) {
      return (
        <Text size="sm" c="dimmed">
          No data in this range.
        </Text>
      );
    }

    return (
      <Group gap="xs" wrap="wrap">
        {entries.map(([status, count]) => (
          <Badge
            key={status}
            color={getStatusColor(status)}
            variant="light"
            radius="sm"
          >
            {formatStatusLabel(status)}: {count.toLocaleString()}
          </Badge>
        ))}
      </Group>
    );
  };

  const renderExpenseBreakdown = () => {
    if (!data || data.expenses.categories.length === 0) {
      return (
        <Text size="sm" c="dimmed">
          No expenses recorded for this range.
        </Text>
      );
    }

    const total = data.expenses.totalAmount || 1;

    return (
      <Stack gap="sm">
        {data.expenses.categories.slice(0, 5).map((category) => {
          const percentage = Math.round((category.amount / total) * 100);
          return (
            <Group
              key={category.category}
              justify="space-between"
              align="center"
            >
              <div>
                <Text fw={600}>{category.category}</Text>
                <Text size="xs" c="dimmed">
                  {FormatterService.formatCurrency(category.amount)} •{' '}
                  {percentage}%
                </Text>
              </div>
            </Group>
          );
        })}
      </Stack>
    );
  };

  return (
    <PageLayout title="Employee Dashboard" withPadding fluid>
      <Stack gap="lg">
        <Paper withBorder p="md" radius="md">
          <Stack gap="md">
            <Group
              justify="space-between"
              align="flex-end"
              wrap="wrap"
              gap="md"
            >
              <Stack gap={6} style={{ flex: 1, minWidth: 260 }}>
                <SegmentedControl
                  fullWidth
                  value={viewMode}
                  onChange={(value) =>
                    actions.setViewMode(value as DashboardViewMode)
                  }
                  data={viewOptions}
                />
                <Group gap="sm" wrap="wrap">
                  {viewMode === 'day' && (
                    <DatePickerInput
                      label="Select date"
                      value={selections.date}
                      onChange={actions.setDate}
                      maxDate={new Date()}
                      valueFormat="YYYY-MM-DD"
                    />
                  )}
                  {viewMode === 'month' && (
                    <MonthPickerInput
                      label="Select month"
                      value={selections.month}
                      onChange={actions.setMonth}
                      maxDate={new Date()}
                      valueFormat="MMMM YYYY"
                    />
                  )}
                  {viewMode === 'year' && (
                    <YearPickerInput
                      label="Select year"
                      value={selections.year}
                      onChange={actions.setYear}
                      maxDate={new Date()}
                      valueFormat="YYYY"
                    />
                  )}
                </Group>
              </Stack>
              <Stack gap={4} align="flex-end" style={{ minWidth: 200 }}>
                <Button
                  variant="light"
                  leftSection={<IconRefresh size={16} />}
                  onClick={actions.refetch}
                  disabled={loading}
                >
                  Refresh
                </Button>
                <Text size="sm" c="dimmed" ta="right">
                  Showing data for {rangeLabel || `${range.from} – ${range.to}`}
                </Text>
              </Stack>
            </Group>
            {error && (
              <Alert
                variant="light"
                color="red"
                icon={<IconAlertCircle size={16} />}
              >
                {error}
              </Alert>
            )}
          </Stack>
        </Paper>

        {isInitialLoading && (
          <Group justify="center" py="xl">
            <Loader size="lg" />
          </Group>
        )}

        {!isInitialLoading && (
          <Stack gap="lg" style={{ opacity: shouldDimContent ? 0.6 : 1 }}>
            {statsCards.length > 0 && (
              <StatsCardGrid cards={statsCards} variant="vibrant" />
            )}

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Group gap="sm">
                    <IconUsersGroup size={20} />
                    <Text fw={600}>Attendance Overview</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {FormatterService.formatNumber(
                      data?.attendance.uniqueEmployees ?? 0,
                      0
                    )}{' '}
                    team member(s) logged within this range.
                  </Text>
                  {data && renderStatusBadges(data.attendance.statusCounts)}
                </Stack>
              </Paper>

              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Group gap="sm">
                    <IconReceipt2 size={20} />
                    <Text fw={600}>Expenses</Text>
                  </Group>
                  <Text size="lg" fw={700}>
                    {FormatterService.formatCurrency(
                      data?.expenses.totalAmount ?? 0
                    )}
                  </Text>
                  {renderExpenseBreakdown()}
                </Stack>
              </Paper>

              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Group gap="sm">
                    <IconCash size={20} />
                    <Text fw={600}>Payroll</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {FormatterService.formatNumber(
                      data?.payroll.processedCount ?? 0,
                      0
                    )}{' '}
                    of{' '}
                    {FormatterService.formatNumber(
                      data?.payroll.totalRecords ?? 0,
                      0
                    )}{' '}
                    payroll runs processed.
                  </Text>
                  {data && renderStatusBadges(data.payroll.statusCounts)}
                </Stack>
              </Paper>

              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Group gap="sm">
                    <IconCalendarStats size={20} />
                    <Text fw={600}>Leave Tracker</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {FormatterService.formatNumber(
                      data?.leaves.totalRequests ?? 0,
                      0
                    )}{' '}
                    request(s) overlapping this range.
                  </Text>
                  {data && renderStatusBadges(data.leaves.statusCounts)}
                </Stack>
              </Paper>

              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Group gap="sm">
                    <IconReportMoney size={20} />
                    <Text fw={600}>Cash Advance</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Active: {data?.cashAdvance.activeCount ?? 0} • Outstanding
                    balance{' '}
                    {FormatterService.formatCurrency(
                      data?.cashAdvance.outstandingBalance ?? 0
                    )}
                  </Text>
                  {data && renderStatusBadges(data.cashAdvance.statusCounts)}
                </Stack>
              </Paper>

              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Group gap="sm">
                    <IconGiftCard size={20} />
                    <Text fw={600}>13th Month Pay</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Accrued{' '}
                    {FormatterService.formatCurrency(
                      data?.thirteenthMonth.totalAccrued ?? 0
                    )}{' '}
                    • Paid{' '}
                    {FormatterService.formatCurrency(
                      data?.thirteenthMonth.totalPaid ?? 0
                    )}
                  </Text>
                  {data &&
                    renderStatusBadges(data.thirteenthMonth.statusCounts)}
                </Stack>
              </Paper>
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Group gap="sm">
                    <IconChartBar size={20} />
                    <Text fw={600}>Attendance Distribution</Text>
                  </Group>
                  <div style={{ height: 260 }}>
                    {attendanceChartData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={attendanceChartData} barSize={32}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            opacity={0.4}
                          />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                          />
                          <RechartsTooltip
                            formatter={(value: number | string) =>
                              FormatterService.formatNumber(Number(value), 0)
                            }
                          />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                            {attendanceChartData.map((entry) => (
                              <Cell
                                key={entry.status}
                                fill={getStatusChartColor(entry.status)}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <ChartEmptyState message="No attendance data to visualize." />
                    )}
                  </div>
                </Stack>
              </Paper>

              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Group gap="sm">
                    <IconChartPie size={20} />
                    <Text fw={600}>Expense Breakdown</Text>
                  </Group>
                  <div style={{ height: 260 }}>
                    {expensesChartData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={expensesChartData}
                            dataKey="value"
                            nameKey="label"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={2}
                          >
                            {expensesChartData.map((entry) => (
                              <Cell key={entry.label} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(value: number | string) =>
                              FormatterService.formatCurrency(Number(value))
                            }
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <ChartEmptyState message="No expense categories in this range." />
                    )}
                  </div>
                </Stack>
              </Paper>
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Group gap="sm">
                    <IconCash size={20} />
                    <Text fw={600}>Payroll vs. Spending</Text>
                  </Group>
                  <div style={{ height: 260 }}>
                    {payrollComparisonData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={payrollComparisonData} barSize={32}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            opacity={0.4}
                          />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis tickLine={false} axisLine={false} />
                          <RechartsTooltip
                            formatter={(value: number | string) =>
                              FormatterService.formatCurrency(Number(value))
                            }
                          />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                            {payrollComparisonData.map((entry) => (
                              <Cell key={entry.label} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <ChartEmptyState message="No payroll or spending data recorded." />
                    )}
                  </div>
                </Stack>
              </Paper>

              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Group gap="sm">
                    <IconUsers size={20} />
                    <Text fw={600}>Department Headcount</Text>
                  </Group>
                  <div style={{ height: 260 }}>
                    {departmentChartData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={departmentChartData}
                          layout="vertical"
                          margin={{ left: 0, right: 20, top: 10, bottom: 10 }}
                        >
                          <CartesianGrid
                            horizontal={false}
                            strokeDasharray="3 3"
                            opacity={0.4}
                          />
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            dataKey="label"
                            type="category"
                            width={120}
                            tickLine={false}
                            axisLine={false}
                          />
                          <RechartsTooltip
                            formatter={(value: number | string) =>
                              FormatterService.formatNumber(Number(value), 0)
                            }
                          />
                          <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                            {departmentChartData.map((entry) => (
                              <Cell key={entry.label} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <ChartEmptyState message="No department breakdown available." />
                    )}
                  </div>
                </Stack>
              </Paper>
            </SimpleGrid>

            <Paper withBorder p="md" radius="md">
              <Stack gap="sm">
                <Group gap="sm">
                  <IconUsers size={20} />
                  <Text fw={600}>Team Snapshot</Text>
                </Group>
                <Group gap="xl" wrap="wrap">
                  <Stack gap={0}>
                    <Text size="xs" c="dimmed">
                      Headcount
                    </Text>
                    <Text fw={700} size="xl">
                      {FormatterService.formatNumber(
                        data?.team.headcount ?? 0,
                        0
                      )}
                    </Text>
                  </Stack>
                  <Stack gap={0}>
                    <Text size="xs" c="dimmed">
                      New hires in range
                    </Text>
                    <Text fw={700} size="xl">
                      {FormatterService.formatNumber(
                        data?.team.newHires ?? 0,
                        0
                      )}
                    </Text>
                  </Stack>
                </Group>
                {data && renderStatusBadges(data.team.statusCounts)}
                <Stack gap="xs">
                  <Text size="sm" fw={600}>
                    Top Departments
                  </Text>
                  {data && data.team.departments.length > 0 ? (
                    <Stack gap={4}>
                      {data.team.departments.map((dept) => (
                        <Group key={dept.name} justify="space-between">
                          <Text>{dept.name}</Text>
                          <Badge color="blue" variant="light">
                            {dept.count}
                          </Badge>
                        </Group>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">
                      No department data available.
                    </Text>
                  )}
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        )}
      </Stack>
    </PageLayout>
  );
}

export function EmployeeDashboardPage() {
  return (
    <DashboardErrorBoundary>
      <DashboardContent />
    </DashboardErrorBoundary>
  );
}
