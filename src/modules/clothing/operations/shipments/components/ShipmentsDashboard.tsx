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

import { useMemo, useState } from 'react';
import {
  SimpleGrid,
  Card,
  Text,
  Group,
  Stack,
  Title,
  Table,
  Box,
  Select,
} from '@mantine/core';
import {
  IconPackage,
  IconBox,
  IconCurrencyPeso,
  IconClockUp,
  IconClockDown,
  IconChartLine,
  IconCalendar,
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

interface ComparisonData {
  currentYear: MonthlyAnalytics[];
  previousYear: MonthlyAnalytics[];
  maxShipments: number;
  maxSacks: number;
  maxCBM: number;
}

export function ShipmentsDashboard({ shipments }: ShipmentsDashboardProps) {
  // State for selected year
  const [selectedYear, setSelectedYear] = useState<string>(
    new Date().getFullYear().toString()
  );

  // Generate year options (current year and past 5 years)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 10; i++) {
      const year = currentYear - i;
      years.push({ value: year.toString(), label: year.toString() });
    }
    return years;
  }, []);

  // Calculate monthly analytics for both selected and previous year
  const { monthlyData, yearlyTotals, comparisonData } = useMemo(() => {
    const currentYear = parseInt(selectedYear);
    const previousYear = currentYear - 1;
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

    const calculateYearData = (year: number) => {
      const yearAnalytics: MonthlyAnalytics[] = [];

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

        const monthShipments = shipments.filter((shipment) => {
          if (!shipment['Date Created']) {
            return false;
          }
          const dateCreated = new Date(shipment['Date Created']);
          return (
            !isNaN(dateCreated.getTime()) &&
            dateCreated.getMonth() === monthIndex &&
            dateCreated.getFullYear() === year
          );
        });

        analytics.totalShipments = monthShipments.length;

        const durations: number[] = [];

        monthShipments.forEach((shipment) => {
          const sacks = Number(shipment['No. Of Sacks']) || 0;
          analytics.totalSacks += sacks;

          const cbm = Number(shipment['Total CBM']) || 0;
          analytics.totalCBM += cbm;

          const fee = Number(shipment['Fee']) || 0;
          analytics.totalFees += fee;

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

        if (durations.length > 0) {
          analytics.longestDuration = Math.max(...durations);
          analytics.shortestDuration = Math.min(...durations);
          analytics.averageDuration = Math.round(
            durations.reduce((sum, d) => sum + d, 0) / durations.length
          );
        }

        yearAnalytics.push(analytics);
      }

      return yearAnalytics;
    };

    const currentYearData = calculateYearData(currentYear);
    const previousYearData = calculateYearData(previousYear);

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

    // Calculate max values for scaling
    const allShipments = [...currentYearData, ...previousYearData].map(
      (m) => m.totalShipments
    );
    const allSacks = [...currentYearData, ...previousYearData].map(
      (m) => m.totalSacks
    );
    const allCBM = [...currentYearData, ...previousYearData].map(
      (m) => m.totalCBM
    );

    const comparison: ComparisonData = {
      currentYear: currentYearData,
      previousYear: previousYearData,
      maxShipments: Math.max(...allShipments, 1),
      maxSacks: Math.max(...allSacks, 1),
      maxCBM: Math.max(...allCBM, 1),
    };

    return {
      monthlyData: monthlyAnalytics,
      yearlyTotals: totals,
      comparisonData: comparison,
    };
  }, [shipments, selectedYear]);

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between">
        <div>
          <Title order={2}>Yearly Analytics</Title>
          <Text size="sm" c="dimmed">
            {selectedYear} - Monthly Breakdown
          </Text>
        </div>
        <Select
          value={selectedYear}
          onChange={(value) => setSelectedYear(value || selectedYear)}
          data={yearOptions}
          leftSection={<IconCalendar size={16} />}
          w={120}
          allowDeselect={false}
        />
      </Group>

      {/* Yearly Totals Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        {/* Total Shipments */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500} c="dimmed">
              Total Shipments ({selectedYear})
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
              Total Sacks ({selectedYear})
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
              Total CBM ({selectedYear})
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
              Total Fees ({selectedYear})
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

      {/* 3 Comparison Canvases Side by Side */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {/* Total Shipments vs Last Year */}
        <Card shadow="sm" padding="lg" radius="md" withBorder h={450}>
          <Title order={4} mb="xs">
            Total Shipments vs Last Year
          </Title>
          <Group gap={4} mb="md">
            <Box
              style={{
                width: 12,
                height: 12,
                backgroundColor: '#adb5bd',
                borderRadius: 2,
              }}
            />
            <Text size="xs" c="dimmed">
              {parseInt(selectedYear) - 1}
            </Text>
            <Box
              style={{
                width: 12,
                height: 12,
                backgroundColor: 'var(--mantine-color-blue-6)',
                borderRadius: 2,
                marginLeft: 8,
              }}
            />
            <Text size="xs" c="dimmed">
              {selectedYear}
            </Text>
          </Group>
          <Group
            gap={4}
            align="flex-end"
            justify="space-around"
            style={{ height: 300 }}
          >
            {comparisonData.currentYear.map((month, index) => {
              const prevMonth = comparisonData.previousYear[index];
              const maxHeight = 290; // Maximum height in pixels
              const currentHeight =
                comparisonData.maxShipments > 0
                  ? (month.totalShipments / comparisonData.maxShipments) *
                    maxHeight
                  : 0;
              const prevHeight =
                comparisonData.maxShipments > 0
                  ? (prevMonth.totalShipments / comparisonData.maxShipments) *
                    maxHeight
                  : 0;

              return (
                <Group key={month.month} gap={1} align="flex-end">
                  <Box
                    style={{
                      width: 8,
                      height: prevHeight > 0 ? Math.max(prevHeight, 4) : 0,
                      backgroundColor: '#adb5bd',
                      borderRadius: 2,
                    }}
                  />
                  <Box
                    style={{
                      width: 8,
                      height:
                        currentHeight > 0 ? Math.max(currentHeight, 4) : 0,
                      backgroundColor: 'var(--mantine-color-blue-6)',
                      borderRadius: 2,
                    }}
                  />
                </Group>
              );
            })}
          </Group>
          <Group justify="space-between" mt="xs">
            {[
              'Jan',
              'Feb',
              'Mar',
              'Apr',
              'May',
              'Jun',
              'Jul',
              'Aug',
              'Sep',
              'Oct',
              'Nov',
              'Dec',
            ].map((month) => (
              <Text key={month} size="xs" c="dimmed">
                {month}
              </Text>
            ))}
          </Group>
        </Card>

        {/* Total Sacks vs Last Year */}
        <Card shadow="sm" padding="lg" radius="md" withBorder h={450}>
          <Title order={4} mb="xs">
            Total Sacks vs Last Year
          </Title>
          <Group gap={4} mb="md">
            <Box
              style={{
                width: 12,
                height: 12,
                backgroundColor: '#adb5bd',
                borderRadius: 2,
              }}
            />
            <Text size="xs" c="dimmed">
              {parseInt(selectedYear) - 1}
            </Text>
            <Box
              style={{
                width: 12,
                height: 12,
                backgroundColor: 'var(--mantine-color-orange-6)',
                borderRadius: 2,
                marginLeft: 8,
              }}
            />
            <Text size="xs" c="dimmed">
              {selectedYear}
            </Text>
          </Group>
          <Group
            gap={4}
            align="flex-end"
            justify="space-around"
            style={{ height: 300 }}
          >
            {comparisonData.currentYear.map((month, index) => {
              const prevMonth = comparisonData.previousYear[index];
              const maxHeight = 290; // Maximum height in pixels
              const currentHeight =
                comparisonData.maxSacks > 0
                  ? (month.totalSacks / comparisonData.maxSacks) * maxHeight
                  : 0;
              const prevHeight =
                comparisonData.maxSacks > 0
                  ? (prevMonth.totalSacks / comparisonData.maxSacks) * maxHeight
                  : 0;

              return (
                <Group key={month.month} gap={1} align="flex-end">
                  <Box
                    style={{
                      width: 8,
                      height: prevHeight > 0 ? Math.max(prevHeight, 4) : 0,
                      backgroundColor: '#adb5bd',
                      borderRadius: 2,
                    }}
                  />
                  <Box
                    style={{
                      width: 8,
                      height:
                        currentHeight > 0 ? Math.max(currentHeight, 4) : 0,
                      backgroundColor: 'var(--mantine-color-orange-6)',
                      borderRadius: 2,
                    }}
                  />
                </Group>
              );
            })}
          </Group>
          <Group justify="space-between" mt="xs">
            {[
              'Jan',
              'Feb',
              'Mar',
              'Apr',
              'May',
              'Jun',
              'Jul',
              'Aug',
              'Sep',
              'Oct',
              'Nov',
              'Dec',
            ].map((month) => (
              <Text key={month} size="xs" c="dimmed">
                {month}
              </Text>
            ))}
          </Group>
        </Card>

        {/* Total CBM vs Last Year */}
        {/* Total CBM vs Last Year */}
        <Card shadow="sm" padding="lg" radius="md" withBorder h={450}>
          <Title order={4} mb="xs">
            Total CBM vs Last Year
          </Title>
          <Group gap={4} mb="md">
            <Box
              style={{
                width: 12,
                height: 12,
                backgroundColor: '#adb5bd',
                borderRadius: 2,
              }}
            />
            <Text size="xs" c="dimmed">
              {parseInt(selectedYear) - 1}
            </Text>
            <Box
              style={{
                width: 12,
                height: 12,
                backgroundColor: 'var(--mantine-color-green-6)',
                borderRadius: 2,
                marginLeft: 8,
              }}
            />
            <Text size="xs" c="dimmed">
              {selectedYear}
            </Text>
          </Group>
          <Group
            gap={4}
            align="flex-end"
            justify="space-around"
            style={{ height: 300 }}
          >
            {comparisonData.currentYear.map((month, index) => {
              const prevMonth = comparisonData.previousYear[index];
              const maxHeight = 290; // Maximum height in pixels
              const currentHeight =
                comparisonData.maxCBM > 0
                  ? (month.totalCBM / comparisonData.maxCBM) * maxHeight
                  : 0;
              const prevHeight =
                comparisonData.maxCBM > 0
                  ? (prevMonth.totalCBM / comparisonData.maxCBM) * maxHeight
                  : 0;

              return (
                <Group key={month.month} gap={1} align="flex-end">
                  <Box
                    style={{
                      width: 8,
                      height: prevHeight > 0 ? Math.max(prevHeight, 4) : 0,
                      backgroundColor: '#adb5bd',
                      borderRadius: 2,
                    }}
                  />
                  <Box
                    style={{
                      width: 8,
                      height:
                        currentHeight > 0 ? Math.max(currentHeight, 4) : 0,
                      backgroundColor: 'var(--mantine-color-teal-6)',
                      borderRadius: 2,
                    }}
                  />
                </Group>
              );
            })}
          </Group>
          <Group justify="space-between" mt="xs">
            {[
              'Jan',
              'Feb',
              'Mar',
              'Apr',
              'May',
              'Jun',
              'Jul',
              'Aug',
              'Sep',
              'Oct',
              'Nov',
              'Dec',
            ].map((month) => (
              <Text key={month} size="xs" c="dimmed">
                {month}
              </Text>
            ))}
          </Group>
        </Card>
      </SimpleGrid>

      {/* Empty State */}
      {yearlyTotals.totalShipments === 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Text size="sm" c="dimmed" ta="center">
            No shipments data available for {selectedYear}
          </Text>
        </Card>
      )}
    </Stack>
  );
}
