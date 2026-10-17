'use client';

import {
  Box,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
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
    <Stack
      gap="sm"
      component="section"
      aria-label={title}
      style={{ minWidth: 0 }}
    >
      <Title order={4}>{title}</Title>
      <Box h={300} style={{ minWidth: 0 }}>
        {hasValues ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart
              data={rows}
              margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
              accessibilityLayer
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--mantine-color-gray-3)"
              />
              <XAxis
                dataKey="month"
                tickFormatter={monthLabel}
                tick={{ fontSize: 12 }}
                minTickGap={20}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value: number) =>
                  `PHP ${compact.format(value / 100)}`
                }
                tick={{ fontSize: 12 }}
                width={84}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                labelFormatter={(label) => monthLabel(String(label))}
                formatter={(value) => money(Number(value))}
              />
              <Legend />
              {includeReturns && (
                <Bar
                  dataKey="returns"
                  name="Unpaid returns"
                  stackId="cash"
                  fill="#0f766e"
                  maxBarSize={44}
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
                fill="#2563eb"
                maxBarSize={44}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Box h="100%" style={{ display: 'grid', placeItems: 'center' }}>
            <Text c="dimmed">
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
    </Stack>
  );
}

export function InvestorCharts({ data }: { data: Dashboard }) {
  return (
    <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
      <FundingChart
        title="Monthly cash requirements (12 months)"
        rows={data.cashByMonth}
        includeReturns
      />
      <FundingChart
        title="Outstanding principal by maturity month"
        rows={data.principalByMaturity}
        includeReturns={false}
      />
    </SimpleGrid>
  );
}
