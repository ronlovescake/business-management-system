import { memo } from 'react';
import { Group, TextInput, Select, FileButton, Button } from '@mantine/core';
import {
  IconTruckDelivery,
  IconSearch,
  IconFilter,
  IconCalendarStats,
  IconUpload,
  IconDownload,
  IconPlus,
} from '@tabler/icons-react';
import {
  ControlPanelCard,
  type ControlPanelTabConfig,
} from '@/components/ui/ControlPanelCard';
import { actionButtonStyles } from '@/components/shared/styles/actionButtonStyles';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';

interface VehicleAssignmentsControlPanelProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string | null;
  onStatusFilterChange: (value: string | null) => void;
  driverFilter: string | null;
  onDriverFilterChange: (value: string | null) => void;
  dateRangeFilter: 'all' | '7' | '30';
  onDateRangeFilterChange: (value: 'all' | '7' | '30') => void;
  drivers: string[];
  onImport: (file: File | null) => void;
  onExport: () => void;
  onAdd: () => void;
  isImporting: boolean;
}

const dateRangeOptions = [
  { label: 'All Dates', value: 'all' },
  { label: 'Last 7 Days', value: '7' },
  { label: 'Last 30 Days', value: '30' },
];

const statusOptions = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

export const VehicleAssignmentsControlPanel = memo(
  function VehicleAssignmentsControlPanel({
    searchQuery,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    driverFilter,
    onDriverFilterChange,
    dateRangeFilter,
    onDateRangeFilterChange,
    drivers,
    onImport,
    onExport,
    onAdd,
    isImporting,
  }: VehicleAssignmentsControlPanelProps) {
    useCtrlFFocus('[data-ctrlf-target="vehicle-assignments-search"]', true);

    const tabs: ControlPanelTabConfig[] = [
      {
        value: 'assignments',
        label: 'Assignments',
        leftSection: <IconTruckDelivery size={16} />,
        panel: (
          <Group wrap="wrap" gap="sm">
            <TextInput
              placeholder="Search vehicle, plate, driver, or helper"
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(event) => onSearchChange(event.currentTarget.value)}
              style={{ flex: 1, minWidth: 260 }}
              data-ctrlf-target="vehicle-assignments-search"
            />
            <Select
              placeholder="Filter by status"
              data={statusOptions}
              value={statusFilter || 'all'}
              onChange={(value) =>
                onStatusFilterChange(value && value !== 'all' ? value : null)
              }
              leftSection={<IconFilter size={14} />}
              style={{ width: 180 }}
            />
            <Select
              placeholder="Filter by driver"
              data={[
                { label: 'All Drivers', value: 'all' },
                ...drivers.map((d) => ({ label: d, value: d })),
              ]}
              value={driverFilter || 'all'}
              onChange={(value) =>
                onDriverFilterChange(value && value !== 'all' ? value : null)
              }
              leftSection={<IconFilter size={14} />}
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
              style={{ width: 160 }}
            />
            <FileButton onChange={onImport} accept=".csv,text/csv">
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
              onClick={onExport}
              variant="light"
            >
              Export
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              size="sm"
              radius="sm"
              color="green"
              onClick={onAdd}
            >
              Add Assignment
            </Button>
          </Group>
        ),
      },
    ];

    return (
      <ControlPanelCard
        title="Vehicle Assignments"
        tabs={tabs}
        activeTab="assignments"
        onTabChange={() => undefined}
      />
    );
  }
);
