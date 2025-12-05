import { Badge, Card, Stack, Text, Title } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  TripsTable,
  type TripRecord,
} from '@/modules/trucking/operations/trips/components/TripsTable';

const placeholderTrips: TripRecord[] = [
  {
    id: 'trip-001',
    date: '2025-11-30',
    truckId: 'TRK-102',
    grossRevenue: 45000,
    fuelCost: 9500,
    maintenance: 1800,
    tollFees: 1200,
    driver: 'Jonas Velasco',
    helper: 'Mia Santos',
    miscExpenses: 750,
    totalExpenses: 13250,
    remarks: 'Double drop-off, Metro Manila loop',
  },
  {
    id: 'trip-002',
    date: '2025-12-02',
    truckId: 'TRK-205',
    grossRevenue: 52000,
    fuelCost: 10200,
    maintenance: 0,
    tollFees: 1450,
    driver: 'Luis Dizon',
    helper: 'Ivan Cruz',
    miscExpenses: 600,
    totalExpenses: 12250,
    remarks: 'North Luzon pharma delivery',
  },
];

export default function TripsPage() {
  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={2}>Trips</Title>
          <Text c="dimmed" size="sm">
            This workspace module is ready for build-out. Connect dispatch data,
            fleet telemetry, or billing workflows here when you are ready to
            ship the trucking ops experience.
          </Text>
        </Stack>

        <Card withBorder padding="lg" radius="md" shadow="xs">
          <Stack gap="sm">
            <Stack gap={2}>
              <Text fw={600}>Status</Text>
              <Badge color="gray" variant="light" size="lg">
                Placeholder
              </Badge>
            </Stack>
            <Text size="sm" c="dimmed">
              No UI has been wired up yet. Add Mantine components, data grids,
              or charts inside this module as you define the trucking trips
              workflow.
            </Text>
          </Stack>
        </Card>

        <TripsTable data={placeholderTrips} />
      </Stack>
    </PageLayout>
  );
}
