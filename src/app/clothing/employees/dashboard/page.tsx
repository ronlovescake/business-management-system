'use client';

import { useMemo, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Center,
  Grid,
  Group,
  Loader,
  Paper,
  Progress,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import {
  DatePickerInput,
  MonthPickerInput,
  YearPickerInput,
} from '@mantine/dates';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { ChartCard } from '@/components/charts/ChartCard';
import { KpiCard } from '@/components/charts/KpiCard';
import { LegendDot } from '@/components/charts/LegendDot';
import { StackedBarChart } from '@/components/charts/StackedBarChart';
import { DonutChart, type DonutSlice } from '@/components/charts/DonutChart';
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { TrendAreaChart } from '@/components/charts/TrendAreaChart';
import {
  CHART_PALETTE,
  formatCompactPeso,
} from '@/components/charts/chartTheme';
import { dayjs } from '@/utils/date';
import { DashboardErrorBoundary } from './components/DashboardErrorBoundary';
import { useEmployeeDashboard } from './hooks/useEmployeeDashboard';
import type { DashboardViewMode, EmployeeDashboardResponse } from './types';
import { FormatterService } from '@/services/FormatterService';

const STATUS_COLOR_MAP: Record<string, string> = {
  active: 'teal',
  terminated: 'red',
  resigned: 'gray',
  inactive: 'gray',
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
  calculated: 'indigo',
  cancelled: 'gray',
};

const ATTENDANCE_COLORS = {
  present: '#40c057',
  late: '#fab005',
  absent: '#fa5252',
  onLeave: '#be4bdb',
};

const DEDUCTION_COLOR = '#ff8787';
const POSITIVE_COLOR = '#20c997';

const viewOptions = [
  { label: 'Daily', value: 'day' },
  { label: 'Monthly', value: 'month' },
  { label: 'Yearly', value: 'year' },
];

const tableStyles = {
  th: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
    color: 'var(--mantine-color-dimmed)',
  },
};

const formatCurrency = (value: number) =>
  FormatterService.formatCurrency(value);
const formatCount = (value: number) => FormatterService.formatNumber(value, 0);
const formatShortDate = (value: string) => {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('MMM D') : value;
};

function formatStatusLabel(status: string): string {
  return FormatterService.titleCase(status.replace(/[-_]/g, ' '));
}

function getStatusColor(status: string): string {
  return STATUS_COLOR_MAP[status.toLowerCase()] || 'gray';
}

function StatusBadges({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).filter(([, value]) => value > 0);
  if (entries.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No records in this range.
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

function EmptyState({ height, message }: { height: number; message: string }) {
  return (
    <Center h={height}>
      <Text size="sm" c="dimmed" ta="center">
        {message}
      </Text>
    </Center>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text
      size="xs"
      c="dimmed"
      tt="uppercase"
      fw={600}
      style={{ letterSpacing: '0.3px' }}
    >
      {children}
    </Text>
  );
}

function buildPayrollBars(payroll: EmployeeDashboardResponse['payroll']) {
  const { earnings, deductions } = payroll;
  return [
    {
      name: 'Basic salary',
      value: earnings.basicSalary,
      color: CHART_PALETTE.primary,
    },
    {
      name: 'Allowance',
      value: earnings.allowance,
      color: CHART_PALETTE.primary,
    },
    {
      name: 'Overtime',
      value: earnings.overtime,
      color: CHART_PALETTE.primary,
    },
    { name: 'Bonuses', value: earnings.bonuses, color: CHART_PALETTE.primary },
    { name: 'SSS', value: deductions.sss, color: DEDUCTION_COLOR },
    {
      name: 'PhilHealth',
      value: deductions.philHealth,
      color: DEDUCTION_COLOR,
    },
    { name: 'Pag-IBIG', value: deductions.pagIbig, color: DEDUCTION_COLOR },
    { name: 'Tax', value: deductions.tax, color: DEDUCTION_COLOR },
    { name: 'Loans', value: deductions.loans, color: DEDUCTION_COLOR },
    { name: 'LWOP', value: deductions.lwop, color: DEDUCTION_COLOR },
    {
      name: 'Absences/lates',
      value: deductions.absentsLates,
      color: DEDUCTION_COLOR,
    },
    {
      name: 'Cash advance',
      value: deductions.cashAdvance,
      color: DEDUCTION_COLOR,
    },
  ].filter((row) => row.value > 0);
}

function DashboardContent({ apiBasePath }: { apiBasePath?: string }) {
  const {
    data,
    loading,
    error,
    viewMode,
    rangeLabel,
    range,
    actions,
    selections,
  } = useEmployeeDashboard(apiBasePath);

  const attendanceSlices = useMemo<DonutSlice[]>(() => {
    if (!data) {
      return [];
    }
    const counts = data.attendance.statusCounts;
    const valueOf = (status: string) =>
      Object.entries(counts)
        .filter(([key]) => key.toLowerCase() === status)
        .reduce((sum, [, count]) => sum + count, 0);
    return [
      {
        name: 'Present',
        value: valueOf('present'),
        color: ATTENDANCE_COLORS.present,
      },
      { name: 'Late', value: valueOf('late'), color: ATTENDANCE_COLORS.late },
      {
        name: 'Absent',
        value: valueOf('absent'),
        color: ATTENDANCE_COLORS.absent,
      },
      {
        name: 'On leave',
        value: valueOf('on-leave'),
        color: ATTENDANCE_COLORS.onLeave,
      },
    ].filter((slice) => slice.value > 0);
  }, [data]);

  const payrollBars = useMemo(
    () => (data ? buildPayrollBars(data.payroll) : []),
    [data]
  );

  const isInitialLoading = loading && !data;
  const shouldDimContent = loading && !!data;
  const hasTrend = (data?.attendance.trend.length ?? 0) > 1;
  const attendanceTrendHasData =
    data?.attendance.trend.some(
      (point) => point.present + point.late + point.absent + point.onLeave > 0
    ) ?? false;
  const payrollTrendHasData =
    data?.payroll.trend.some((point) => point.gross !== 0 || point.net !== 0) ??
    false;
  const trendSubtitle =
    data?.attendance.granularity === 'month' ? 'By month' : 'By day';

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

        {!isInitialLoading && data && (
          <Stack gap="lg" style={{ opacity: shouldDimContent ? 0.6 : 1 }}>
            <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 6 }} spacing="md">
              <KpiCard
                label="Active employees"
                value={formatCount(data.team.activeCount)}
                caption={`${formatCount(data.team.headcount)} on file · ${formatCount(data.team.newHires)} new hire(s)`}
              />
              <KpiCard
                label="Attendance rate"
                value={
                  data.attendance.attendanceRate === null
                    ? '—'
                    : `${data.attendance.attendanceRate.toFixed(1)}%`
                }
                caption={`${formatCount(data.attendance.uniqueEmployees)} people · ${formatCount(data.attendance.totalRecords)} records`}
              />
              <KpiCard
                label="Hours logged"
                value={`${FormatterService.formatNumber(data.attendance.totalHours, 1)} h`}
                caption={
                  data.attendance.averageHours === null
                    ? 'No attendance logged'
                    : `Avg ${data.attendance.averageHours.toFixed(1)} h per record`
                }
              />
              <KpiCard
                label="Payroll net pay"
                value={formatCurrency(data.payroll.totalNet)}
                caption={`Gross ${formatCompactPeso(data.payroll.totalGross)} · ${formatCount(data.payroll.totalRecords)} run(s)`}
              />
              <KpiCard
                label="Leave days"
                value={formatCount(data.leaves.totalDays)}
                caption={`${formatCount(data.leaves.totalRequests)} request(s) in range`}
              />
              <KpiCard
                label="Cash advance owed"
                value={formatCurrency(data.cashAdvance.outstandingBalance)}
                badge="Open"
                caption="All open balances"
              />
            </SimpleGrid>

            <Grid gutter="md">
              <Grid.Col span={{ base: 12, xl: 8 }}>
                <ChartCard
                  title="Attendance trend"
                  subtitle={trendSubtitle}
                  actions={
                    <Group gap="md" visibleFrom="sm">
                      <LegendDot
                        color={ATTENDANCE_COLORS.present}
                        label="Present"
                      />
                      <LegendDot color={ATTENDANCE_COLORS.late} label="Late" />
                      <LegendDot
                        color={ATTENDANCE_COLORS.absent}
                        label="Absent"
                      />
                      <LegendDot
                        color={ATTENDANCE_COLORS.onLeave}
                        label="On leave"
                      />
                    </Group>
                  }
                >
                  {!hasTrend ? (
                    <EmptyState
                      height={280}
                      message="Switch to Monthly or Yearly to see the attendance trend."
                    />
                  ) : attendanceTrendHasData ? (
                    <StackedBarChart
                      data={data.attendance.trend}
                      xKey="label"
                      height={280}
                      valueFormatter={(value) => formatCount(value)}
                      series={[
                        {
                          dataKey: 'present',
                          name: 'Present',
                          color: ATTENDANCE_COLORS.present,
                        },
                        {
                          dataKey: 'late',
                          name: 'Late',
                          color: ATTENDANCE_COLORS.late,
                        },
                        {
                          dataKey: 'absent',
                          name: 'Absent',
                          color: ATTENDANCE_COLORS.absent,
                        },
                        {
                          dataKey: 'onLeave',
                          name: 'On leave',
                          color: ATTENDANCE_COLORS.onLeave,
                        },
                      ]}
                    />
                  ) : (
                    <EmptyState
                      height={280}
                      message="No attendance logged in this range."
                    />
                  )}
                </ChartCard>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6, xl: 4 }}>
                <ChartCard
                  title="Attendance status"
                  subtitle="Share of records"
                >
                  {attendanceSlices.length === 0 ? (
                    <EmptyState
                      height={280}
                      message="No attendance logged in this range."
                    />
                  ) : (
                    <DonutChart
                      data={attendanceSlices}
                      centerLabel="Records"
                      centerValue={formatCount(data.attendance.totalRecords)}
                      valueFormatter={formatCount}
                      labelHeader="Status"
                      valueHeader="Records"
                    />
                  )}
                </ChartCard>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6, xl: 6 }}>
                <ChartCard
                  title="Payroll breakdown"
                  subtitle="Earnings and deductions for pay periods starting in range"
                  actions={
                    data.payroll.totalRecords > 0 ? (
                      <Badge variant="light" color="indigo" radius="sm">
                        {`${data.payroll.processedCount}/${data.payroll.totalRecords} processed`}
                      </Badge>
                    ) : null
                  }
                >
                  <SimpleGrid cols={3} spacing="md" mb="md">
                    <Figure
                      label="Gross pay"
                      value={formatCurrency(data.payroll.totalGross)}
                    />
                    <Figure
                      label="Deductions"
                      value={formatCurrency(data.payroll.totalDeductions)}
                    />
                    <Figure
                      label="Net pay"
                      value={formatCurrency(data.payroll.totalNet)}
                      tone="positive"
                    />
                  </SimpleGrid>
                  {payrollBars.length === 0 ? (
                    <EmptyState
                      height={220}
                      message="No payroll in this range."
                    />
                  ) : (
                    <HorizontalBarChart
                      data={payrollBars}
                      valueFormatter={formatCurrency}
                      height={Math.max(160, payrollBars.length * 26)}
                      labelWidth={110}
                    />
                  )}
                  <Stack gap={6} mt="sm">
                    <SectionLabel>Payroll status</SectionLabel>
                    <StatusBadges counts={data.payroll.statusCounts} />
                  </Stack>
                </ChartCard>
              </Grid.Col>

              <Grid.Col span={{ base: 12, xl: 6 }}>
                <ChartCard
                  title="Payroll trend"
                  subtitle={trendSubtitle}
                  actions={
                    <Group gap="md">
                      <LegendDot color={CHART_PALETTE.primary} label="Gross" />
                      <LegendDot color={POSITIVE_COLOR} label="Net" />
                    </Group>
                  }
                >
                  {!hasTrend ? (
                    <EmptyState
                      height={300}
                      message="Switch to Monthly or Yearly to see the payroll trend."
                    />
                  ) : payrollTrendHasData ? (
                    <TrendAreaChart
                      data={data.payroll.trend}
                      xKey="label"
                      valueFormatter={(value) => formatCurrency(value)}
                      series={[
                        {
                          dataKey: 'gross',
                          name: 'Gross',
                          color: CHART_PALETTE.primary,
                          strokeWidth: 2.5,
                        },
                        {
                          dataKey: 'net',
                          name: 'Net',
                          color: POSITIVE_COLOR,
                          strokeWidth: 2.5,
                        },
                      ]}
                    />
                  ) : (
                    <EmptyState
                      height={300}
                      message="No payroll in this range."
                    />
                  )}
                </ChartCard>
              </Grid.Col>

              <Grid.Col span={{ base: 12, lg: 8 }}>
                <ChartCard
                  title="Team members"
                  subtitle="Active employees and anyone with attendance, payroll or open cash advances"
                >
                  {data.members.length === 0 ? (
                    <EmptyState
                      height={200}
                      message="No team members to show."
                    />
                  ) : (
                    <ScrollArea h={380} type="hover" offsetScrollbars>
                      <Table
                        verticalSpacing="xs"
                        highlightOnHover
                        stickyHeader
                        styles={tableStyles}
                      >
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Employee</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>
                              Present
                            </Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>
                              Late
                            </Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>
                              Absent
                            </Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>
                              Leave
                            </Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>
                              Hours
                            </Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>
                              Net pay
                            </Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>
                              CA balance
                            </Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {data.members.map((member) => (
                            <Table.Tr key={member.employeeId}>
                              <Table.Td>
                                <Group gap={6} wrap="nowrap">
                                  <Text size="sm" fw={500} truncate maw={180}>
                                    {member.name}
                                  </Text>
                                  {member.status &&
                                  member.status !== 'active' ? (
                                    <Badge
                                      size="xs"
                                      variant="light"
                                      color={getStatusColor(member.status)}
                                    >
                                      {formatStatusLabel(member.status)}
                                    </Badge>
                                  ) : null}
                                </Group>
                                <Text size="xs" c="dimmed" truncate maw={220}>
                                  {[member.position, member.department]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                {member.present}
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text
                                  size="sm"
                                  c={member.late > 0 ? 'yellow.8' : undefined}
                                >
                                  {member.late}
                                </Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text
                                  size="sm"
                                  c={member.absent > 0 ? 'red.7' : undefined}
                                >
                                  {member.absent}
                                </Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                {member.onLeave}
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                {FormatterService.formatNumber(member.hours, 1)}
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text size="sm" fw={600} c="dark.7">
                                  {formatCurrency(member.netPay)}
                                </Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text
                                  size="sm"
                                  c={
                                    member.cashAdvanceBalance > 0
                                      ? 'orange.8'
                                      : 'dimmed'
                                  }
                                >
                                  {formatCurrency(member.cashAdvanceBalance)}
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
                <ChartCard
                  title="Team"
                  subtitle="Active headcount by department"
                >
                  <Stack gap="md">
                    {data.team.departments.length === 0 ? (
                      <EmptyState height={120} message="No active employees." />
                    ) : (
                      <HorizontalBarChart
                        data={data.team.departments.map((dept) => ({
                          name: dept.name,
                          value: dept.count,
                          color: CHART_PALETTE.primary,
                        }))}
                        valueFormatter={formatCount}
                        axisFormatter={formatCount}
                        seriesName="Employees"
                        labelWidth={100}
                        height={Math.max(
                          120,
                          data.team.departments.length * 30
                        )}
                      />
                    )}
                    <SimpleGrid cols={2} spacing="xs">
                      <Figure
                        label="New hires"
                        value={formatCount(data.team.newHires)}
                      />
                      <Figure
                        label="Separations"
                        value={formatCount(data.team.separations)}
                      />
                    </SimpleGrid>
                    <Stack gap={6}>
                      <SectionLabel>Employee status</SectionLabel>
                      <StatusBadges counts={data.team.statusCounts} />
                    </Stack>
                    {Object.keys(data.team.employmentStatusCounts).length >
                    0 ? (
                      <Stack gap={6}>
                        <SectionLabel>Employment type</SectionLabel>
                        <StatusBadges
                          counts={data.team.employmentStatusCounts}
                        />
                      </Stack>
                    ) : null}
                    {data.team.recentHires.length > 0 ? (
                      <Stack gap={6}>
                        <SectionLabel>Hired in this range</SectionLabel>
                        {data.team.recentHires.map((hire) => (
                          <Group
                            key={`${hire.name}-${hire.hireDate}`}
                            justify="space-between"
                            wrap="nowrap"
                          >
                            <div style={{ minWidth: 0 }}>
                              <Text size="sm" fw={500} truncate>
                                {hire.name}
                              </Text>
                              <Text size="xs" c="dimmed" truncate>
                                {[hire.position, hire.department]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </Text>
                            </div>
                            <Text size="xs" c="dimmed">
                              {formatShortDate(hire.hireDate)}
                            </Text>
                          </Group>
                        ))}
                      </Stack>
                    ) : null}
                  </Stack>
                </ChartCard>
              </Grid.Col>

              <Grid.Col span={{ base: 12, lg: 6 }}>
                <ChartCard
                  title="Leave tracker"
                  subtitle="Requests overlapping this range"
                  actions={
                    <Badge variant="light" color="grape" radius="sm">
                      {`${formatCount(data.leaves.totalDays)} day(s)`}
                    </Badge>
                  }
                >
                  <Stack gap="sm">
                    <StatusBadges counts={data.leaves.statusCounts} />
                    {data.leaves.byType.length > 0 ? (
                      <Group gap="xs" wrap="wrap">
                        {data.leaves.byType.map((type) => (
                          <Badge
                            key={type.type}
                            variant="outline"
                            color="grape"
                            radius="sm"
                          >
                            {`${type.type} · ${type.requests} req · ${type.days} day(s)`}
                          </Badge>
                        ))}
                      </Group>
                    ) : null}
                    {data.leaves.requests.length > 0 ? (
                      <Table verticalSpacing={6} styles={tableStyles}>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Employee</Table.Th>
                            <Table.Th>Type</Table.Th>
                            <Table.Th>Dates</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>
                              Days
                            </Table.Th>
                            <Table.Th>Status</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {data.leaves.requests.map((request) => (
                            <Table.Tr key={request.id}>
                              <Table.Td>
                                <Text size="sm" truncate maw={160}>
                                  {request.employeeName}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{request.leaveType}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm" c="dimmed">
                                  {request.startDate === request.endDate
                                    ? formatShortDate(request.startDate)
                                    : `${formatShortDate(request.startDate)} – ${formatShortDate(request.endDate)}`}
                                </Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                {request.days}
                              </Table.Td>
                              <Table.Td>
                                <Badge
                                  size="sm"
                                  variant="light"
                                  color={getStatusColor(request.status)}
                                >
                                  {formatStatusLabel(request.status)}
                                </Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    ) : null}
                  </Stack>
                </ChartCard>
              </Grid.Col>

              <Grid.Col span={{ base: 12, lg: 6 }}>
                <ChartCard
                  title="Cash advances"
                  subtitle="Requests in range and all open balances"
                >
                  <Stack gap="sm">
                    <SimpleGrid cols={3} spacing="md">
                      <Figure
                        label="Requested in range"
                        value={formatCurrency(data.cashAdvance.totalRequested)}
                      />
                      <Figure
                        label="Requests"
                        value={`${formatCount(data.cashAdvance.totalRecords)} (${formatCount(data.cashAdvance.activeCount)} active)`}
                      />
                      <Figure
                        label="Outstanding"
                        value={formatCurrency(
                          data.cashAdvance.outstandingBalance
                        )}
                        tone={
                          data.cashAdvance.outstandingBalance > 0
                            ? 'negative'
                            : undefined
                        }
                      />
                    </SimpleGrid>
                    <StatusBadges counts={data.cashAdvance.statusCounts} />
                    {data.cashAdvance.openBalances.length > 0 ? (
                      <Table verticalSpacing={6} styles={tableStyles}>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Employee</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>
                              Amount
                            </Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>
                              Remaining
                            </Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>
                              Monthly
                            </Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {data.cashAdvance.openBalances.map((advance) => (
                            <Table.Tr key={advance.id}>
                              <Table.Td>
                                <Text size="sm" truncate maw={170}>
                                  {advance.employeeName}
                                </Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text size="sm" c="dimmed">
                                  {formatCurrency(advance.amount)}
                                </Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text size="sm" fw={600} c="orange.8">
                                  {formatCurrency(advance.remainingBalance)}
                                </Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text size="sm">
                                  {advance.monthlyPayment > 0
                                    ? formatCurrency(advance.monthlyPayment)
                                    : '—'}
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    ) : (
                      <Text size="sm" c="dimmed">
                        No open cash-advance balances.
                      </Text>
                    )}
                  </Stack>
                </ChartCard>
              </Grid.Col>

              <Grid.Col span={12}>
                <ChartCard
                  title="13th month pay"
                  subtitle={`Records for ${dayjs(data.range.from).year() === dayjs(data.range.to).year() ? dayjs(data.range.from).year() : `${dayjs(data.range.from).year()}–${dayjs(data.range.to).year()}`}`}
                >
                  <Stack gap="md">
                    <SimpleGrid cols={3} spacing="md">
                      <Figure
                        label="Accrued"
                        value={formatCurrency(
                          data.thirteenthMonth.totalAccrued
                        )}
                      />
                      <Figure
                        label="Paid"
                        value={formatCurrency(data.thirteenthMonth.totalPaid)}
                        tone="positive"
                      />
                      <Figure
                        label="Unpaid"
                        value={formatCurrency(
                          Math.max(
                            0,
                            data.thirteenthMonth.totalAccrued -
                              data.thirteenthMonth.totalPaid
                          )
                        )}
                      />
                    </SimpleGrid>
                    <div>
                      <Group justify="space-between" mb={4}>
                        <Text size="xs" c="dimmed">
                          Paid out
                        </Text>
                        <Text size="xs" fw={600}>
                          {data.thirteenthMonth.totalAccrued > 0
                            ? `${((data.thirteenthMonth.totalPaid / data.thirteenthMonth.totalAccrued) * 100).toFixed(0)}%`
                            : '—'}
                        </Text>
                      </Group>
                      <Progress
                        radius="xl"
                        size="lg"
                        color="teal"
                        value={
                          data.thirteenthMonth.totalAccrued > 0
                            ? Math.min(
                                100,
                                (data.thirteenthMonth.totalPaid /
                                  data.thirteenthMonth.totalAccrued) *
                                  100
                              )
                            : 0
                        }
                      />
                    </div>
                    <Text size="sm" c="dimmed">
                      {formatCount(data.thirteenthMonth.totalRecords)} record(s)
                    </Text>
                    <StatusBadges counts={data.thirteenthMonth.statusCounts} />
                  </Stack>
                </ChartCard>
              </Grid.Col>
            </Grid>
          </Stack>
        )}
      </Stack>
    </PageLayout>
  );
}

export function EmployeesDashboard({ apiBasePath }: { apiBasePath?: string }) {
  return (
    <DashboardErrorBoundary>
      <DashboardContent apiBasePath={apiBasePath} />
    </DashboardErrorBoundary>
  );
}

export default function EmployeeDashboard() {
  return <EmployeesDashboard />;
}
