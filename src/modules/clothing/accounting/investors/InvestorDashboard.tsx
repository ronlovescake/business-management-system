'use client';

import {
  ActionIcon,
  Avatar,
  Badge,
  Grid,
  Group,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconCalendar,
  IconCalendarOff,
  IconCash,
  IconChevronRight,
  IconCircleCheck,
  IconWallet,
} from '@tabler/icons-react';
import { StatsCardGrid } from '@/components/ui';
import { formatDateOnly } from '@/utils/dateFormatters';
import { FormatterService } from '@/services/FormatterService';
import { InvestorPayoutStatus } from './InvestorPresentation';
import type { buildInvestorDashboard, DashboardPayout } from './dashboard';
import { InvestorCashOutlook } from './InvestorCharts';
import {
  DashboardCard,
  DashboardList,
  DashboardRow,
  DateBlock,
} from './InvestorDashboardCards';

type Dashboard = ReturnType<typeof buildInvestorDashboard>;
const money = (cents: number) => FormatterService.formatCurrency(cents / 100);
const date = (value: string | null) => (value ? formatDateOnly(value) : '-');

export function InvestorDashboardMetrics({ data }: { data: Dashboard }) {
  return (
    <StatsCardGrid
      variant="vibrant"
      minCardWidth={220}
      spacing="md"
      cards={[
        {
          title: 'Outstanding Funded Investment',
          value: money(data.outstanding),
          color: 'blue',
          backgroundColor: 'linear-gradient(135deg, #3b82f6, #2563eb)',
          icon: <IconWallet size={24} />,
        },
        {
          title: 'Unpaid returns due',
          value: money(data.dueTotal),
          color: 'orange',
          backgroundColor: 'linear-gradient(135deg, #d97706, #b45309)',
          icon: <IconAlertCircle size={24} />,
        },
        {
          title: 'Returns in next 30 days',
          value: money(data.next30),
          color: 'teal',
          backgroundColor: 'linear-gradient(135deg, #14b8a6, #0f766e)',
          icon: <IconCash size={24} />,
        },
        {
          title: 'Investment maturing in 90 days',
          value: money(data.maturing90),
          color: 'red',
          backgroundColor: 'linear-gradient(135deg, #ef4444, #b91c1c)',
          icon: <IconCalendar size={24} />,
        },
      ]}
    />
  );
}

const activityStyle: Record<string, { color: string; icon: typeof IconCash }> =
  {
    'Funding received': { color: 'blue', icon: IconArrowDownLeft },
    'Return paid': { color: 'teal', icon: IconCash },
    'Investment repaid': { color: 'grape', icon: IconArrowUpRight },
  };

export function InvestorDashboard({
  data,
  today,
  search,
  closureYears,
  onMarkPaid,
  onOpenInvestor,
}: {
  data: Dashboard;
  today: string;
  search: string;
  closureYears: string[];
  onMarkPaid: (payout: DashboardPayout) => void;
  onOpenInvestor: (id: string, agreementId?: string) => void;
}) {
  const matches = (...values: string[]) =>
    values.join(' ').toLowerCase().includes(search.trim().toLowerCase());
  const due = data.due.filter((row) =>
    matches(row.investorName, row.reference)
  );
  const upcoming = data.upcoming.filter((row) =>
    matches(row.investorName, row.reference)
  );
  const maturities = data.maturities.filter((row) =>
    matches(row.investorName, row.reference)
  );
  const investors = data.investors.filter((row) =>
    matches(row.name, ...row.references)
  );
  const activity = data.activity.filter((row) =>
    matches(row.investorName, row.reference)
  );
  const review = new Map(
    [
      ...data.warnings.unlinked,
      ...data.warnings.unposted,
      ...data.warnings.matured,
    ].map((row) => [row.id, row])
  );
  const warnings = Array.from(review.values()).filter((row) =>
    matches(row.investorName, row.reference)
  );
  const missingYears = data.calendarYears.filter(
    (year) => !closureYears.includes(year)
  );
  const horizon = new Date(`${today}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 90);
  const horizonDate = horizon.toISOString().slice(0, 10);
  const maturityStatus = (row: (typeof maturities)[number]) =>
    row.schedule.principalRepaymentDeadline < today
      ? { label: 'Past deadline', color: 'red' }
      : row.schedule.maturityDate <= today
        ? { label: 'Matured', color: 'orange' }
        : row.schedule.maturityDate <= horizonDate
          ? { label: 'Within 90 days', color: 'yellow' }
          : { label: 'Active', color: 'blue' };
  const sum = (values: number[]) =>
    values.reduce((total, value) => total + value, 0);
  const issues = (row: (typeof warnings)[number]) =>
    [
      !row.accounting.fundedDate &&
        'Funding not linked; excluded from investment totals',
      row.accounting.unpostedPayments > 0 &&
        `${row.accounting.unpostedPayments} paid return(s) without linked journal postings`,
      row.accounting.fundedDate &&
        !row.accounting.repaidDate &&
        row.schedule.maturityDate <= today &&
        'Matured investment awaiting repayment',
    ]
      .filter(Boolean)
      .join(' · ');
  const open = (label: string, id: string, agreementId?: string) => (
    <ActionIcon
      variant="subtle"
      color="gray"
      radius="xl"
      aria-label={`View portfolio for ${label}`}
      onClick={() => onOpenInvestor(id, agreementId)}
    >
      <IconChevronRight size={16} />
    </ActionIcon>
  );
  const payoutRow = (row: DashboardPayout, tone: string) => (
    <DashboardRow
      leading={<DateBlock value={row.dueDate ?? today} tone={tone} />}
      title={row.investorName}
      subtitle={`${row.reference} · Month ${row.month} · ${date(row.dueDate)}`}
      trailing={
        <>
          <Text size="sm" fw={600}>
            {money(row.amountCents)}
          </Text>
          <InvestorPayoutStatus
            payout={row}
            today={today}
            onMarkPaid={() => onMarkPaid(row)}
          />
        </>
      }
    />
  );
  const payoutKey = (row: DashboardPayout) => `${row.agreementId}-${row.month}`;
  const reviewCount = warnings.length + (missingYears.length ? 1 : 0);
  return (
    <Stack gap="lg" style={{ minWidth: 0 }}>
      {reviewCount > 0 && (
        <DashboardCard
          title="Agreement review"
          accent="orange"
          description={`${reviewCount} item(s) need attention before relying on dashboard totals.`}
        >
          <Stack gap="sm">
            {missingYears.length > 0 && (
              <DashboardRow
                leading={
                  <ThemeIcon
                    variant="light"
                    color="yellow"
                    radius="xl"
                    size="lg"
                  >
                    <IconCalendarOff size={18} />
                  </ThemeIcon>
                }
                title="Missing bank-calendar coverage"
                subtitle={`No bank closures recorded for ${missingYears.join(', ')}.`}
              />
            )}
            {warnings.map((row) => (
              <DashboardRow
                key={row.id}
                leading={
                  <ThemeIcon
                    variant="light"
                    color="orange"
                    radius="xl"
                    size="lg"
                  >
                    <IconAlertTriangle size={18} />
                  </ThemeIcon>
                }
                title={`${row.investorName} · ${row.reference}`}
                subtitle={issues(row)}
                trailing={open(row.reference, row.investorId, row.id)}
              />
            ))}
          </Stack>
        </DashboardCard>
      )}
      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="lg">
            <InvestorCashOutlook data={data} />
            <DashboardCard
              title="Upcoming payouts (90 days)"
              description={
                upcoming.length
                  ? `${upcoming.length} scheduled · ${money(sum(upcoming.map((row) => row.amountCents)))}`
                  : undefined
              }
            >
              <DashboardList
                items={upcoming}
                limit={6}
                getKey={payoutKey}
                renderItem={(row) => payoutRow(row, 'teal')}
                empty="No payouts scheduled in the next 90 days."
              />
            </DashboardCard>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="lg">
            <DashboardCard
              title="Unpaid due returns"
              accent={data.due.length ? 'orange' : 'teal'}
              description={
                due.length
                  ? `${due.length} due · ${money(sum(due.map((row) => row.amountCents)))}`
                  : undefined
              }
            >
              {data.due.length ? (
                <DashboardList
                  items={due}
                  limit={4}
                  getKey={payoutKey}
                  renderItem={(row) => payoutRow(row, 'orange')}
                  empty="No due returns match this search."
                />
              ) : (
                <Group gap="sm" wrap="nowrap" role="status">
                  <ThemeIcon variant="light" color="teal" radius="xl" size="lg">
                    <IconCircleCheck size={18} />
                  </ThemeIcon>
                  <div>
                    <Text size="sm" fw={600}>
                      All caught up
                    </Text>
                    <Text size="xs" c="dimmed">
                      No unpaid returns due
                    </Text>
                  </div>
                </Group>
              )}
            </DashboardCard>
            <DashboardCard
              title="Investment maturities"
              description={
                maturities.length
                  ? `${maturities.length} outstanding · ${money(sum(maturities.map((row) => row.principalCents)))}`
                  : undefined
              }
            >
              <DashboardList
                items={maturities}
                limit={4}
                getKey={(row) => row.id}
                renderItem={(row) => {
                  const status = maturityStatus(row);
                  return (
                    <DashboardRow
                      leading={
                        <DateBlock
                          value={row.schedule.maturityDate}
                          tone={status.color}
                          showYear
                        />
                      }
                      title={`${row.reference} · ${money(row.principalCents)}`}
                      subtitle={`${row.investorName} · Repay by ${date(row.schedule.principalRepaymentDeadline)}`}
                      trailing={
                        <>
                          <Badge size="sm" variant="light" color={status.color}>
                            {status.label}
                          </Badge>
                          {open(row.reference, row.investorId, row.id)}
                        </>
                      }
                    />
                  );
                }}
                empty="No outstanding funded investment."
              />
            </DashboardCard>
            <DashboardCard title="Recent activity">
              <DashboardList
                items={activity}
                limit={5}
                getKey={(row) => row.id}
                renderItem={(row) => {
                  const style =
                    activityStyle[row.kind] ?? activityStyle['Return paid'];
                  const Icon = style.icon;
                  return (
                    <DashboardRow
                      leading={
                        <ThemeIcon
                          variant="light"
                          color={style.color}
                          radius="xl"
                          size="lg"
                        >
                          <Icon size={18} />
                        </ThemeIcon>
                      }
                      title={row.kind}
                      subtitle={`${row.investorName} · ${row.reference} · ${date(row.date)}`}
                      trailing={
                        <>
                          <Text size="sm" fw={600}>
                            {money(row.cents)}
                          </Text>
                          {open(row.reference, row.investorId, row.agreementId)}
                        </>
                      }
                    />
                  );
                }}
                empty="No recorded movements yet."
              />
            </DashboardCard>
            <DashboardCard title="Investors">
              <DashboardList
                items={investors}
                limit={5}
                getKey={(row) => row.id}
                renderItem={(row) => (
                  <DashboardRow
                    leading={
                      <Avatar radius="xl" color="blue" variant="light">
                        {row.name
                          .split(/\s+/)
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </Avatar>
                    }
                    title={row.name}
                    subtitle={`${row.agreements} agreement(s) · Next payout ${date(row.nextPayout)}`}
                    trailing={
                      <>
                        <Text size="sm" fw={600}>
                          {money(row.outstanding)}
                        </Text>
                        {open(row.name, row.id)}
                      </>
                    }
                  />
                )}
                empty="No investors match this search."
              />
            </DashboardCard>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
