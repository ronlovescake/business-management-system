'use client';

import type { ReactNode } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCalendar,
  IconCash,
  IconWallet,
} from '@tabler/icons-react';
import { StatsCardGrid } from '@/components/ui';
import { formatDateOnly } from '@/utils/dateFormatters';
import { FormatterService } from '@/services/FormatterService';
import { InvestorPayoutStatus, InvestorTable } from './InvestorPresentation';
import type { buildInvestorDashboard, DashboardPayout } from './dashboard';
import { InvestorCharts } from './InvestorCharts';

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
          title: 'Outstanding funded principal',
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
          title: 'Principal maturing in 90 days',
          value: money(data.maturing90),
          color: 'red',
          backgroundColor: 'linear-gradient(135deg, #ef4444, #b91c1c)',
          icon: <IconCalendar size={24} />,
        },
      ]}
    />
  );
}

function DashboardTable({
  title,
  columns,
  children,
  empty,
}: {
  title: string;
  columns: string[];
  children: ReactNode;
  empty: boolean;
}) {
  return (
    <Stack
      gap="sm"
      component="section"
      aria-label={title}
      style={{ minWidth: 0 }}
    >
      <Title order={4}>{title}</Title>
      <Box style={{ maxHeight: 360, overflow: 'auto' }}>
        <InvestorTable height="auto" minWidth={700}>
          <Table.Thead>
            <Table.Tr>
              {columns.map((column) => (
                <Table.Th key={column}>{column}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {empty ? (
              <Table.Tr>
                <Table.Td colSpan={columns.length}>
                  <Text ta="center" c="dimmed" py="lg">
                    No matching records.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              children
            )}
          </Table.Tbody>
        </InvestorTable>
      </Box>
    </Stack>
  );
}

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
  const payoutRows = (rows: DashboardPayout[]) =>
    rows.map((row) => (
      <Table.Tr key={`${row.agreementId}-${row.month}`}>
        <Table.Td>{date(row.dueDate)}</Table.Td>
        <Table.Td>{row.investorName}</Table.Td>
        <Table.Td>{row.reference}</Table.Td>
        <Table.Td ta="right" fw={600}>
          {money(row.amountCents)}
        </Table.Td>
        <Table.Td>
          <InvestorPayoutStatus
            payout={row}
            today={today}
            onMarkPaid={() => onMarkPaid(row)}
          />
        </Table.Td>
      </Table.Tr>
    ));
  const portfolio = (id: string, agreementId?: string) => (
    <Button
      variant="subtle"
      size="compact-sm"
      onClick={() => onOpenInvestor(id, agreementId)}
    >
      View portfolio
    </Button>
  );
  return (
    <Stack gap="xl" style={{ minWidth: 0 }}>
      <Stack gap="sm">
        {missingYears.length > 0 && (
          <Alert color="yellow" title="Missing bank-calendar coverage">
            No bank closures recorded for {missingYears.join(', ')}.
          </Alert>
        )}
        {data.warnings.unlinked.length > 0 && (
          <Alert color="yellow" title="Unlinked funding">
            {data.warnings.unlinked.length} agreement(s) excluded from confirmed
            principal totals pending funding reconciliation.
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
          <DashboardTable
            title="Agreement review"
            columns={[
              'Investor',
              'Agreement',
              'Attention required',
              'Portfolio',
            ]}
            empty={!warnings.length}
          >
            {warnings.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>{row.investorName}</Table.Td>
                <Table.Td>{row.reference}</Table.Td>
                <Table.Td>
                  <Stack gap={4}>
                    {!row.accounting.fundedDate && (
                      <Text size="sm">Funding not linked</Text>
                    )}
                    {row.accounting.unpostedPayments > 0 && (
                      <Text size="sm">
                        {row.accounting.unpostedPayments} paid return(s) without
                        linked journal postings
                      </Text>
                    )}
                    {row.accounting.fundedDate &&
                      !row.accounting.repaidDate &&
                      row.schedule.maturityDate <= today && (
                        <Text size="sm">
                          Matured principal awaiting repayment
                        </Text>
                      )}
                  </Stack>
                </Table.Td>
                <Table.Td>{portfolio(row.investorId, row.id)}</Table.Td>
              </Table.Tr>
            ))}
          </DashboardTable>
          <DashboardTable
            title="Investor overview"
            columns={[
              'Investor',
              'Agreements',
              'Outstanding funded principal',
              'Next unpaid banking date',
              'Nearest funded maturity',
              'Portfolio',
            ]}
            empty={!investors.length}
          >
            {investors.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>{row.name}</Table.Td>
                <Table.Td>{row.agreements}</Table.Td>
                <Table.Td fw={600}>{money(row.outstanding)}</Table.Td>
                <Table.Td>{date(row.nextPayout)}</Table.Td>
                <Table.Td>{date(row.maturity)}</Table.Td>
                <Table.Td>{portfolio(row.id)}</Table.Td>
              </Table.Tr>
            ))}
          </DashboardTable>
        </SimpleGrid>
      </Stack>
      <InvestorCharts data={data} />
      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
        <DashboardTable
          title="Cash requirements (cumulative)"
          columns={[
            'Horizon',
            'Returns including unpaid due',
            'Principal by repayment deadline',
            'Total',
          ]}
          empty={false}
        >
          {data.forecast.map((row) => (
            <Table.Tr key={row.days}>
              <Table.Td>Next {row.days} days</Table.Td>
              <Table.Td>{money(row.returns)}</Table.Td>
              <Table.Td>{money(row.principal)}</Table.Td>
              <Table.Td fw={600}>{money(row.total)}</Table.Td>
            </Table.Tr>
          ))}
        </DashboardTable>
        <DashboardTable
          title="Unpaid due returns"
          columns={[
            'Banking date',
            'Investor',
            'Agreement',
            'Return',
            'Status',
          ]}
          empty={!due.length}
        >
          {payoutRows(due)}
        </DashboardTable>
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
        <DashboardTable
          title="Upcoming payouts (90 days)"
          columns={[
            'Banking date',
            'Investor',
            'Agreement',
            'Return',
            'Status',
          ]}
          empty={!upcoming.length}
        >
          {payoutRows(upcoming)}
        </DashboardTable>
        <DashboardTable
          title="Investment maturities"
          columns={[
            'Investor',
            'Agreement',
            'Outstanding principal',
            'Maturity',
            'Repayment deadline',
            'Status',
            'Portfolio',
          ]}
          empty={!maturities.length}
        >
          {maturities.map((row) => (
            <Table.Tr key={row.id}>
              <Table.Td>{row.investorName}</Table.Td>
              <Table.Td>{row.reference}</Table.Td>
              <Table.Td fw={600}>{money(row.principalCents)}</Table.Td>
              <Table.Td>{date(row.schedule.maturityDate)}</Table.Td>
              <Table.Td>
                {date(row.schedule.principalRepaymentDeadline)}
              </Table.Td>
              <Table.Td>
                <Badge
                  color={
                    row.schedule.principalRepaymentDeadline < today
                      ? 'red'
                      : row.schedule.maturityDate <= today
                        ? 'orange'
                        : 'blue'
                  }
                >
                  {row.schedule.principalRepaymentDeadline < today
                    ? 'Past deadline'
                    : row.schedule.maturityDate <= today
                      ? 'Matured'
                      : 'Active'}
                </Badge>
              </Table.Td>
              <Table.Td>{portfolio(row.investorId, row.id)}</Table.Td>
            </Table.Tr>
          ))}
        </DashboardTable>
      </SimpleGrid>
      <DashboardTable
        title="Recent activity"
        columns={[
          'Date',
          'Investor',
          'Agreement',
          'Movement',
          'Amount',
          'Portfolio',
        ]}
        empty={!activity.length}
      >
        {activity.map((row) => (
          <Table.Tr key={row.id}>
            <Table.Td>{date(row.date)}</Table.Td>
            <Table.Td>{row.investorName}</Table.Td>
            <Table.Td>{row.reference}</Table.Td>
            <Table.Td>{row.kind}</Table.Td>
            <Table.Td fw={600}>{money(row.cents)}</Table.Td>
            <Table.Td>{portfolio(row.investorId, row.agreementId)}</Table.Td>
          </Table.Tr>
        ))}
      </DashboardTable>
    </Stack>
  );
}
