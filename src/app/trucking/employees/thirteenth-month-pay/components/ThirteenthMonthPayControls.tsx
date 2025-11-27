import { memo } from 'react';
import { Group, TextInput, Select, FileButton, Button } from '@mantine/core';
import {
  IconList,
  IconSearch,
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

interface ThirteenthMonthPayControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  yearFilter: string;
  onYearFilterChange: (year: string) => void;
  yearOptions: string[];
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  onAddRecord: () => void;
  addButtonLabel?: string;
  isImporting?: boolean;
}

export const ThirteenthMonthPayControls = memo(
  function ThirteenthMonthPayControls({
    searchQuery,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    yearFilter,
    onYearFilterChange,
    yearOptions,
    onImportCSV,
    onExportCSV,
    onAddRecord,
    addButtonLabel = 'Add Record',
    isImporting,
  }: ThirteenthMonthPayControlsProps) {
    useCtrlFFocus('[data-ctrlf-target="thirteenth-controls-search"]', true);

    const tabs: ControlPanelTabConfig[] = [
      {
        value: 'list',
        label: '13th Month Records',
        leftSection: <IconList size={16} />,
        panel: (
          <Group wrap="wrap" gap="sm">
            <TextInput
              placeholder="Search by employee or year..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(event) => onSearchChange(event.currentTarget.value)}
              style={{ flex: 1, minWidth: 220 }}
              data-ctrlf-target="thirteenth-controls-search"
            />
            <Select
              placeholder="Filter by status"
              data={['All', 'pending', 'calculated', 'approved', 'paid']}
              value={statusFilter === 'all' ? 'All' : statusFilter}
              onChange={(value) =>
                onStatusFilterChange(!value || value === 'All' ? 'all' : value)
              }
              clearable
              style={{ width: 220 }}
            />
            <Select
              placeholder="Filter by year"
              data={yearOptions}
              value={yearFilter === 'all' ? 'All' : yearFilter}
              onChange={(value) =>
                onYearFilterChange(!value || value === 'All' ? 'all' : value)
              }
              clearable
              style={{ width: 200 }}
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
            >
              Export
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              size="sm"
              radius="sm"
              color="green"
              onClick={onAddRecord}
            >
              {addButtonLabel}
            </Button>
          </Group>
        ),
      },
    ];

    return (
      <ControlPanelCard
        title="13th Month Pay Records"
        tabs={tabs}
        activeTab="list"
        onTabChange={() => {}}
      />
    );
  }
);
