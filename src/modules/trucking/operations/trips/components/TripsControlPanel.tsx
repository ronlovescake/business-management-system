import { memo, useState } from 'react';
import {
  Group,
  TextInput,
  Select,
  FileButton,
  Button,
  Stack,
  SimpleGrid,
  Card,
  Text,
} from '@mantine/core';
import {
  IconRoute,
  IconSearch,
  IconSteeringWheel,
  IconTruckDelivery,
  IconUpload,
  IconDownload,
  IconPlus,
  IconCalendarStats,
  IconChartBar,
} from '@tabler/icons-react';
import {
  ControlPanelCard,
  type ControlPanelTabConfig,
} from '@/components/ui/ControlPanelCard';
import { actionButtonStyles } from '@/components/shared/styles/actionButtonStyles';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';

interface TripsControlPanelProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  driverFilter: string | null;
  onDriverFilterChange: (value: string | null) => void;
  truckFilter: string | null;
  onTruckFilterChange: (value: string | null) => void;
  dateRangeFilter: 'all' | '7' | '30';
  onDateRangeFilterChange: (value: 'all' | '7' | '30') => void;
  drivers: string[];
  helpers?: string[]; // reserved for future helper filters
  trucks: string[];
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  onAddTrip: () => void;
  isImporting: boolean;
  analyticsSummary: TripsAnalyticsSummary;
  formatCurrency: (value: number) => string;
}

interface TripsAnalyticsSummary {
  totalTrips: number;
  filteredTrips: number;
  tripsThisMonth: number;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  filteredRevenue: number;
  filteredExpenses: number;
  filteredNet: number;
}

const dateRangeOptions = [
  { label: 'All Dates', value: 'all' },
  { label: 'Last 7 Days', value: '7' },
  { label: 'Last 30 Days', value: '30' },
];

export const TripsControlPanel = memo(function TripsControlPanel({
  searchQuery,
  onSearchChange,
  driverFilter,
  onDriverFilterChange,
  truckFilter,
  onTruckFilterChange,
  dateRangeFilter,
  onDateRangeFilterChange,
  drivers,
  helpers: _helpers,
  trucks,
  onImportCSV,
  onExportCSV,
  onAddTrip,
  isImporting,
  analyticsSummary,
  formatCurrency,
}: TripsControlPanelProps) {
  useCtrlFFocus('[data-ctrlf-target="trips-search"]', true);
  const [activeTab, setActiveTab] = useState<'trips' | 'analytics'>('trips');

  const analyticsMetrics = [
    {
      label: 'Total Trips Logged',
      value: analyticsSummary.totalTrips.toLocaleString(),
    },
    {
      label: 'Trips This Month',
      value: analyticsSummary.tripsThisMonth.toLocaleString(),
    },
    {
      label: 'Filtered Trips',
      value: analyticsSummary.filteredTrips.toLocaleString(),
    },
    {
      label: 'Gross Revenue (All Time)',
      value: formatCurrency(analyticsSummary.totalRevenue),
    },
    {
      label: 'Total Expenses (All Time)',
      value: formatCurrency(analyticsSummary.totalExpenses),
    },
    {
      label: 'Net Income (All Time)',
      value: formatCurrency(analyticsSummary.netIncome),
    },
  ];

  const overallMargin =
    analyticsSummary.totalRevenue > 0
      ? (analyticsSummary.netIncome / analyticsSummary.totalRevenue) * 100
      : 0;
  const filteredMargin =
    analyticsSummary.filteredRevenue > 0
      ? (analyticsSummary.filteredNet / analyticsSummary.filteredRevenue) * 100
      : 0;

  const tabs: ControlPanelTabConfig[] = [
    {
      value: 'trips',
      label: 'Trip Records',
      leftSection: <IconRoute size={16} />,
      panel: (
        <Group wrap="wrap" gap="sm">
          <TextInput
            placeholder="Search driver, helper, truck, or remarks"
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 240 }}
            data-ctrlf-target="trips-search"
          />
          <Select
            placeholder="Filter by driver"
            data={[
              { label: 'All Drivers', value: 'all' },
              ...drivers.map((driver) => ({ label: driver, value: driver })),
            ]}
            value={driverFilter || 'all'}
            onChange={(value) =>
              onDriverFilterChange(value && value !== 'all' ? value : null)
            }
            leftSection={<IconSteeringWheel size={14} />}
            style={{ width: 200 }}
            searchable
          />
          <Select
            placeholder="Filter by truck"
            data={[
              { label: 'All Trucks', value: 'all' },
              ...trucks.map((truck) => ({ label: truck, value: truck })),
            ]}
            value={truckFilter || 'all'}
            onChange={(value) =>
              onTruckFilterChange(value && value !== 'all' ? value : null)
            }
            leftSection={<IconTruckDelivery size={14} />}
            style={{ width: 200 }}
            searchable
          />
          <Select
            placeholder="Date range"
            data={dateRangeOptions}
            value={dateRangeFilter}
            onChange={(value) =>
              onDateRangeFilterChange((value as 'all' | '7' | '30') || 'all')
            }
            leftSection={<IconCalendarStats size={14} />}
            style={{ width: 180 }}
          />
          <FileButton onChange={onImportCSV} accept=".csv,text/csv">
            {(props) => (
              <Button
                {...props}
                leftSection={<IconUpload size={16} />}
                size="sm"
                radius="sm"
                styles={actionButtonStyles}
                loading={isImporting}
              >
                Import CSV
              </Button>
            )}
          </FileButton>
          <Button
            leftSection={<IconDownload size={16} />}
            size="sm"
            radius="sm"
            styles={actionButtonStyles}
            onClick={onExportCSV}
            variant="light"
          >
            Export
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            size="sm"
            radius="sm"
            color="green"
            onClick={onAddTrip}
          >
            Log Trip
          </Button>
        </Group>
      ),
    },
    {
      value: 'analytics',
      label: 'Analytics',
      leftSection: <IconChartBar size={16} />,
      panel: (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {analyticsMetrics.map((metric) => (
              <Card key={metric.label} shadow="sm" radius="md" padding="md">
                <Stack gap={2}>
                  <Text size="xs" c="dimmed" fw={500} tt="uppercase">
                    {metric.label}
                  </Text>
                  <Text size="lg" fw={600}>
                    {metric.value}
                  </Text>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>

          <Card shadow="sm" radius="md" padding="md">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                Filtered view revenue vs expenses
              </Text>
              <Text fw={600}>
                {formatCurrency(analyticsSummary.filteredRevenue)} revenue ·{' '}
                {formatCurrency(analyticsSummary.filteredExpenses)} expenses ·{' '}
                {formatCurrency(analyticsSummary.filteredNet)} net
              </Text>
              <Text size="sm" c="dimmed">
                Overall net margin {overallMargin.toFixed(1)}% · Filtered net
                margin {filteredMargin.toFixed(1)}%
              </Text>
            </Stack>
          </Card>
        </Stack>
      ),
    },
  ];

  return (
    <ControlPanelCard
      title="Trip Records"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(value) =>
        setActiveTab((value as 'trips' | 'analytics') || 'trips')
      }
    />
  );
});
