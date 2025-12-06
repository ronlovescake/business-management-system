import { memo } from 'react';
import { Group, TextInput, Select, FileButton, Button } from '@mantine/core';
import {
  IconRoute,
  IconSearch,
  IconSteeringWheel,
  IconTruckDelivery,
  IconUpload,
  IconDownload,
  IconPlus,
  IconCalendarStats,
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
  trucks: string[];
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  onAddTrip: () => void;
  isImporting: boolean;
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
  trucks,
  onImportCSV,
  onExportCSV,
  onAddTrip,
  isImporting,
}: TripsControlPanelProps) {
  useCtrlFFocus('[data-ctrlf-target="trips-search"]', true);

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
  ];

  return (
    <ControlPanelCard
      title="Trip Records"
      tabs={tabs}
      activeTab="trips"
      onTabChange={() => undefined}
    />
  );
});
