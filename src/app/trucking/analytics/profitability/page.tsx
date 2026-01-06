'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Center,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Button,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { PageLayout } from '@/components/layout/PageLayout';
import { showNotification } from '@mantine/notifications';

type Summary = {
  revenue: number;
  expenses: number;
  net: number;
};

type TripRow = {
  id: string;
  date: string;
  destination: string;
  customerId: number | null;
  grossRevenue: number;
  expenseTotal: number;
};

type ProfitabilityResponse = {
  summary: Summary;
  trips: TripRow[];
};

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export default function ProfitabilityPage() {
  const [data, setData] = useState<ProfitabilityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<
    Array<{ value: string; label: string }>
  >([]);

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers?status=active', {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Failed to load customers');
      }
      const payload = (await response.json()) as
        | Array<{
            id?: number | null;
            customerName?: string | null;
            name?: string | null;
          }>
        | {
            data?: Array<{
              id?: number | null;
              customerName?: string | null;
              name?: string | null;
            }>;
          };

      const list = Array.isArray(payload) ? payload : (payload.data ?? []);

      const options = list
        .map((item) => ({
          value: String(item.id ?? ''),
          label: (item.customerName ?? item.name ?? '').trim(),
        }))
        .filter((item) => item.value && item.label.length > 0)
        .sort((a, b) => a.label.localeCompare(b.label));
      setCustomers(options);
    } catch (err) {
      showNotification({
        title: 'Customers unavailable',
        message:
          err instanceof Error ? err.message : 'Could not load customers',
        color: 'orange',
      });
    }
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (startDate) {
        params.set('startDate', startDate.toISOString().slice(0, 10));
      }
      if (endDate) {
        params.set('endDate', endDate.toISOString().slice(0, 10));
      }
      if (customerId) {
        params.set('customerId', customerId);
      }

      const response = await fetch(
        `/api/trucking/analytics/profitability?${params.toString()}`,
        {
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load profitability');
      }

      const payload = (await response.json()) as ProfitabilityResponse;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchCustomers();
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo<Summary>(() => {
    if (!data) {
      return { revenue: 0, expenses: 0, net: 0 };
    }
    return data.summary;
  }, [data]);

  const formatCurrency = (value: number) => pesoFormatter.format(value);

  const hasTrips = (data?.trips?.length ?? 0) > 0;

  return (
    <PageLayout fluid withPadding>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={3}>Trip Profitability</Title>
          <Group>
            <DateInput
              label="Start date"
              value={startDate}
              onChange={setStartDate}
              clearable
            />
            <DateInput
              label="End date"
              value={endDate}
              onChange={setEndDate}
              clearable
            />
            <Select
              label="Customer"
              placeholder="All customers"
              data={customers}
              value={customerId}
              onChange={setCustomerId}
              clearable
              searchable
              nothingFoundMessage="No customers"
              w={220}
            />
            <Button
              onClick={() => void loadData()}
              loading={isLoading}
              variant="light"
            >
              Apply Filters
            </Button>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Card shadow="sm" padding="md">
            <Text size="sm" c="dimmed">
              Revenue
            </Text>
            <Title order={3}>{formatCurrency(summary.revenue)}</Title>
          </Card>
          <Card shadow="sm" padding="md">
            <Text size="sm" c="dimmed">
              Expenses
            </Text>
            <Title order={3}>{formatCurrency(summary.expenses)}</Title>
          </Card>
          <Card shadow="sm" padding="md">
            <Text size="sm" c="dimmed">
              Net
            </Text>
            <Title order={3}>{formatCurrency(summary.net)}</Title>
          </Card>
        </SimpleGrid>

        <Card shadow="sm" padding="md">
          <Group mb="sm" justify="space-between">
            <Title order={5}>Trips</Title>
            {isLoading && <Loader size="sm" />}
          </Group>
          {error && (
            <Text c="red" size="sm" mb="sm">
              {error}
            </Text>
          )}
          {!isLoading && !hasTrips && (
            <Center py="lg">
              <Text c="dimmed">No trips found for the selected filters.</Text>
            </Center>
          )}
          {hasTrips && (
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Trip</Table.Th>
                  <Table.Th>Customer</Table.Th>
                  <Table.Th ta="right">Revenue</Table.Th>
                  <Table.Th ta="right">Expenses</Table.Th>
                  <Table.Th ta="right">Net</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data?.trips.map((trip) => {
                  const net = trip.grossRevenue - trip.expenseTotal;
                  return (
                    <Table.Tr key={trip.id}>
                      <Table.Td>{formatDate(trip.date)}</Table.Td>
                      <Table.Td>{trip.destination || '—'}</Table.Td>
                      <Table.Td>{trip.customerId ?? '—'}</Table.Td>
                      <Table.Td ta="right">
                        {formatCurrency(trip.grossRevenue)}
                      </Table.Td>
                      <Table.Td ta="right">
                        {formatCurrency(trip.expenseTotal)}
                      </Table.Td>
                      <Table.Td ta="right">{formatCurrency(net)}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      </Stack>
    </PageLayout>
  );
}
