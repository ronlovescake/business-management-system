/**
 * Shipments Dashboard Component
 *
 * Displays detailed yearly analytics by month:
 * - Total shipments per month
 * - Total sacks per month
 * - Total CBM per month
 * - Total fees per month
 * - Longest delivery duration per month
 * - Shortest delivery duration per month
 * - Average delivery duration per month
 */

'use client';

import { useMemo } from 'react';
import {
  SimpleGrid,
  Card,
  Text,
  Group,
  Stack,
  Title,
  Table,
} from '@mantine/core';
import {
  IconPackage,
  IconBox,
  IconCurrencyPeso,
  IconClockUp,
  IconClockDown,
  IconChartLine,
} from '@tabler/icons-react';
import type { ShipmentData } from '../types/shipment.types';

interface ShipmentsDashboardProps {
  shipments: ShipmentData[];
}

interface MonthlyAnalytics {
  month: string;
  totalShipments: number;
  totalSacks: number;
  totalCBM: number;
  totalFees: number;
  longestDuration: number | null;
  shortestDuration: number | null;
  averageDuration: number | null;
}

interface YearlyTotals {
  totalShipments: number;
  totalSacks: number;
  totalCBM: number;
  totalFees: number;
}

export function ShipmentsDashboard({ shipments }: ShipmentsDashboardProps) {
  // Calculate monthly analytics for the entire year
  const { monthlyData, yearlyTotals } = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const monthlyAnalytics: MonthlyAnalytics[] = [];
    const totals: YearlyTotals = {
      totalShipments: 0,
      totalSacks: 0,
      totalCBM: 0,
      totalFees: 0,
    };

    // Process each month (0-11)
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const analytics: MonthlyAnalytics = {
        month: monthNames[monthIndex],
        totalShipments: 0,
        totalSacks: 0,
        totalCBM: 0,
        totalFees: 0,
        longestDuration: null,
        shortestDuration: null,
        averageDuration: null,
      };

      // Filter shipments for this specific month
      const monthShipments = shipments.filter((shipment) => {
        const dateCreated = new Date(shipment['Date Created']);
        return (
          dateCreated.getMonth() === monthIndex &&
          dateCreated.getFullYear() === currentYear
        );
      });

      // Calculate totals for this month
      analytics.totalShipments = monthShipments.length;

      const durations: number[] = [];

      monthShipments.forEach((shipment) => {
        // Total sacks
        const sacks = Number(shipment['No. Of Sacks']) || 0;
        analytics.totalSacks += sacks;

        // Total CBM
        const cbm = Number(shipment['Total CBM']) || 0;
        analytics.totalCBM += cbm;

        // Total fees
        const fee = Number(shipment['Fee']) || 0;
        analytics.totalFees += fee;

        // Calculate delivery duration (only for delivered shipments)
        if (
          shipment['Shipment Status'] === 'Delivered' &&
          shipment['Date Created'] &&
          shipment['Date Delivered']
        ) {
          const dateCreated = new Date(shipment['Date Created']);
          const dateDelivered = new Date(shipment['Date Delivered']);
          const durationInDays = Math.floor(
            (dateDelivered.getTime() - dateCreated.getTime()) /
              (1000 * 60 * 60 * 24)
          );

          if (durationInDays >= 0) {
            durations.push(durationInDays);
          }
        }
      });

      // Calculate duration statistics
      if (durations.length > 0) {
        analytics.longestDuration = Math.max(...durations);
        analytics.shortestDuration = Math.min(...durations);
        analytics.averageDuration = Math.round(
          durations.reduce((sum, d) => sum + d, 0) / durations.length
        );
      }

      // Add to yearly totals
      totals.totalShipments += analytics.totalShipments;
      totals.totalSacks += analytics.totalSacks;
      totals.totalCBM += analytics.totalCBM;
      totals.totalFees += analytics.totalFees;

      monthlyAnalytics.push(analytics);
    }

    return { monthlyData: monthlyAnalytics, yearlyTotals: totals };
  }, [shipments]);

  const currentYear = new Date().getFullYear();

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between">
        <div>
          <Title order={2}>Yearly Analytics</Title>
          <Text size="sm" c="dimmed">
            {currentYear} - Monthly Breakdown
          </Text>
        </div>
      </Group>

      {/* Yearly Totals Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        {/* Total Shipments */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500} c="dimmed">
              Total Shipments ({currentYear})
            </Text>
            <IconPackage size={20} color="var(--mantine-color-blue-6)" />
          </Group>
          <Text size="xl" fw={700}>
            {yearlyTotals.totalShipments.toLocaleString()}
          </Text>
        </Card>

        {/* Total Sacks */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500} c="dimmed">
              Total Sacks ({currentYear})
            </Text>
            <IconPackage size={20} color="var(--mantine-color-orange-6)" />
          </Group>
          <Text size="xl" fw={700}>
            {yearlyTotals.totalSacks.toLocaleString()}
          </Text>
        </Card>

        {/* Total CBM */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500} c="dimmed">
              Total CBM ({currentYear})
            </Text>
            <IconBox size={20} color="var(--mantine-color-teal-6)" />
          </Group>
          <Text size="xl" fw={700}>
            {yearlyTotals.totalCBM.toFixed(2)} m³
          </Text>
        </Card>

        {/* Total Fees */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500} c="dimmed">
              Total Fees ({currentYear})
            </Text>
            <IconCurrencyPeso size={20} color="var(--mantine-color-purple-6)" />
          </Group>
          <Text size="xl" fw={700}>
            ₱{yearlyTotals.totalFees.toLocaleString()}
          </Text>
        </Card>
      </SimpleGrid>

      {/* Monthly Breakdown Table */}
      <div>
        <Title order={3} mb="md">
          Monthly Breakdown
        </Title>
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Month</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Shipments</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Sacks</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>CBM</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Fees</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>
                  <Group gap={4} justify="flex-end">
                    <IconClockDown size={16} />
                    <span>Min Days</span>
                  </Group>
                </Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>
                  <Group gap={4} justify="flex-end">
                    <IconChartLine size={16} />
                    <span>Avg Days</span>
                  </Group>
                </Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>
                  <Group gap={4} justify="flex-end">
                    <IconClockUp size={16} />
                    <span>Max Days</span>
                  </Group>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {monthlyData.map((month) => (
                <Table.Tr key={month.month}>
                  <Table.Td>
                    <Text fw={500}>{month.month}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {month.totalShipments > 0
                      ? month.totalShipments.toLocaleString()
                      : '-'}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {month.totalSacks > 0
                      ? month.totalSacks.toLocaleString()
                      : '-'}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {month.totalCBM > 0
                      ? `${month.totalCBM.toFixed(2)} m³`
                      : '-'}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {month.totalFees > 0
                      ? `₱${month.totalFees.toLocaleString()}`
                      : '-'}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text
                      c={month.shortestDuration !== null ? 'green' : 'dimmed'}
                    >
                      {month.shortestDuration !== null
                        ? `${month.shortestDuration}d`
                        : '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text
                      c={month.averageDuration !== null ? 'blue' : 'dimmed'}
                    >
                      {month.averageDuration !== null
                        ? `${month.averageDuration}d`
                        : '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text c={month.longestDuration !== null ? 'red' : 'dimmed'}>
                      {month.longestDuration !== null
                        ? `${month.longestDuration}d`
                        : '-'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      </div>

      {/* Empty State */}
      {yearlyTotals.totalShipments === 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Text size="sm" c="dimmed" ta="center">
            No shipments data available for {currentYear}
          </Text>
        </Card>
      )}
    </Stack>
  );
}
