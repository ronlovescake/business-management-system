import { memo } from 'react';
import { Group, TextInput, Select, FileButton, Button } from '@mantine/core';
import {
  IconTruck,
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

interface FleetRegistryControlPanelProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string | null;
  onStatusFilterChange: (value: string | null) => void;
  fuelFilter: string | null;
  onFuelFilterChange: (value: string | null) => void;
  makerFilter: string | null;
  onMakerFilterChange: (value: string | null) => void;
  yearFilter: 'all' | '5' | '10';
  onYearFilterChange: (value: 'all' | '5' | '10') => void;
  makers: string[];
  fuels: string[];
  onImport: (file: File | null) => void;
  onExport: () => void;
  onAdd: () => void;
  isImporting: boolean;
}

const statusOptions = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Retired', value: 'retired' },
];

const yearOptions = [
  { label: 'All Years', value: 'all' },
  { label: 'Last 5 Years', value: '5' },
  { label: 'Last 10 Years', value: '10' },
];

export const FleetRegistryControlPanel = memo(
  function FleetRegistryControlPanel({
    searchQuery,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    fuelFilter,
    onFuelFilterChange,
    makerFilter,
    onMakerFilterChange,
    yearFilter,
    onYearFilterChange,
    makers,
    fuels,
    onImport,
    onExport,
    onAdd,
    isImporting,
  }: FleetRegistryControlPanelProps) {
    useCtrlFFocus('[data-ctrlf-target="fleet-registry-search"]', true);

    const tabs: ControlPanelTabConfig[] = [
      {
        value: 'fleet',
        label: 'Fleet Registry',
        leftSection: <IconTruck size={16} />,
        panel: (
          <Group wrap="wrap" gap="sm">
            <TextInput
              placeholder="Search truck, plate, maker, model"
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(event) => onSearchChange(event.currentTarget.value)}
              style={{ flex: 1, minWidth: 260 }}
              data-ctrlf-target="fleet-registry-search"
            />
            <Select
              placeholder="Status"
              data={statusOptions}
              value={statusFilter || 'all'}
              onChange={(value) =>
                onStatusFilterChange(value && value !== 'all' ? value : null)
              }
              leftSection={<IconFilter size={14} />}
              style={{ width: 160 }}
            />
            <Select
              placeholder="Fuel type"
              data={[
                { label: 'All Fuel Types', value: 'all' },
                ...fuels.map((f) => ({ label: f, value: f })),
              ]}
              value={fuelFilter || 'all'}
              onChange={(value) =>
                onFuelFilterChange(value && value !== 'all' ? value : null)
              }
              leftSection={<IconFilter size={14} />}
              style={{ width: 180 }}
            />
            <Select
              placeholder="Maker"
              data={[
                { label: 'All Makers', value: 'all' },
                ...makers.map((m) => ({ label: m, value: m })),
              ]}
              value={makerFilter || 'all'}
              onChange={(value) =>
                onMakerFilterChange(value && value !== 'all' ? value : null)
              }
              leftSection={<IconFilter size={14} />}
              style={{ width: 180 }}
              searchable
            />
            <Select
              placeholder="Year"
              data={yearOptions}
              value={yearFilter}
              onChange={(value) =>
                onYearFilterChange((value as 'all' | '5' | '10') || 'all')
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
              Add Unit
            </Button>
          </Group>
        ),
      },
    ];

    return (
      <ControlPanelCard
        title="Fleet Registry"
        tabs={tabs}
        activeTab="fleet"
        onTabChange={() => undefined}
      />
    );
  }
);
