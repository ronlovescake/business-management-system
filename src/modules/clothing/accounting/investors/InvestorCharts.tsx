'use client';

import { useState } from 'react';
import {
  Box,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  VisuallyHidden,
} from '@mantine/core';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FormatterService } from '@/services/FormatterService';
import type { buildInvestorDashboard } from './dashboard';
import { DashboardCard } from './InvestorDashboardCards';

type Dashboard = ReturnType<typeof buildInvestorDashboard>;
const money = (cents: number) => FormatterService.formatCurrency(cents / 100);
const compact = new Intl.NumberFormat('en-PH', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const monthLabel = (month: string) =>
  month === 'Overdue'
    ? month
    : new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-PH', {
        month: 'short',
        year: '2-digit',
        timeZone: 'UTC',
      });

function FundingChart({
  title,
  rows,
  includeReturns,
}: {
  title: string;
  rows: { month: string; principal: number; returns?: number }[];
  includeReturns: boolean;
}) {
  const hasValues = rows.some(
    (row) => row.principal > 0 || (row.returns ?? 0) > 0
  );
  return (
    <Box component="figure" aria-label={title} m={0} style={{ minWidth: 0 }}>
      <Box h={280} style={{ minWidth: 0 }}>
        {hasValues ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart
              data={rows}
              margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
              barCategoryGap="28%"
              accessibilityLayer
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--mantine-color-gray-2)"
              />
              <XAxis
                dataKey="month"
                tickFormatter={monthLabel}
                tick={{ fontSize: 11, fill: 'var(--mantine-color-gray-6)' }}
                minTickGap={12}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value: number) =>
                  `₱${compact.format(value / 100)}`
                }
                tick={{ fontSize: 11, fill: 'var(--mantine-color-gray-6)' }}
                width={56}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--mantine-color-gray-0)' }}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--mantine-color-gray-3)',
                  fontSize: 12,
                }}
                labelFormatter={(label) => monthLabel(String(label))}
                formatter={(value) => money(Number(value))}
              />
              {includeReturns && (
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12 }}
                />
              )}
              {includeReturns && (
                <Bar
                  dataKey="returns"
                  name="Unpaid returns"
                  stackId="cash"
                  fill="#14b8a6"
                  maxBarSize={36}
                  isAnimationActive={false}
                />
              )}
              <Bar
                dataKey="principal"
                name={
                  includeReturns
                    ? 'Principal by repayment deadline'
                    : 'Outstanding funded principal'
                }
                stackId="cash"
                fill="#3b82f6"
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Box h="100%" style={{ display: 'grid', placeItems: 'center' }}>
            <Text c="dimmed" size="sm">
              {includeReturns
                ? 'No unpaid cash requirements in this period.'
                : 'No outstanding funded principal.'}
            </Text>
          </Box>
        )}
      </Box>
      <VisuallyHidden>
        <Table>
          <caption>{title} data</caption>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Month</Table.Th>
              {includeReturns && <Table.Th>Unpaid returns</Table.Th>}
              <Table.Th>Principal</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.month}>
                <Table.Td>{monthLabel(row.month)}</Table.Td>
                {includeReturns && (
                  <Table.Td>{money(row.returns ?? 0)}</Table.Td>
                )}
                <Table.Td>{money(row.principal)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </VisuallyHidden>
    </Box>
  );
}

export function InvestorCashOutlook({ data }: { data: Dashboard }) {
  const [view, setView] = useState('cash');
  return (
    <DashboardCard
      title="Cash outlook"
      description="Cumulative totals include unpaid returns and principal already due."
      action={
        <SegmentedControl
          size="xs"
          radius="md"
          value={view}
          onChange={setView}
          aria-label="Chart view"
          data={[
            { value: 'cash', label: 'Next 12 months' },
            { value: 'maturity', label: 'Principal maturities' },
          ]}
        />
      }
    >
      <Stack gap="lg">
        <SimpleGrid
          cols={{ base: 1, xs: 3 }}
          spacing="sm"
          aria-label="Cash requirements (cumulative)"
          role="group"
        >
          {data.forecast.map((row) => (
            <Box
              key={row.days}
              p="sm"
              style={{
                minWidth: 0,
                borderRadius: 10,
                background: 'var(--mantine-color-gray-0)',
              }}
            >
              <Text size="xs" c="dimmed" fw={500}>
                Next {row.days} days
              </Text>
              <Text fw={700} fz="lg" style={{ overflowWrap: 'anywhere' }}>
                {money(row.total)}
              </Text>
              <Text size="xs" c="dimmed">
                Returns {money(row.returns)} · Principal {money(row.principal)}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
        {view === 'cash' ? (
          <FundingChart
            title="Monthly cash requirements (12 months)"
            rows={data.cashByMonth}
            includeReturns
          />
        ) : (
          <FundingChart
            title="Outstanding principal by maturity month"
            rows={data.principalByMaturity}
            includeReturns={false}
          />
        )}
      </Stack>
    </DashboardCard>
  );
}
