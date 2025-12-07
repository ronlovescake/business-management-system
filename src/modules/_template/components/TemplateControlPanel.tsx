import { memo } from 'react';
import { Group, TextInput, Select, FileButton, Button } from '@mantine/core';
import {
  IconLayoutGrid,
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

interface TemplateControlPanelProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string | null;
  onCategoryFilterChange: (value: string | null) => void;
  statusFilter: string | null;
  onStatusFilterChange: (value: string | null) => void;
  dateRangeFilter: 'all' | '7' | '30';
  onDateRangeFilterChange: (value: 'all' | '7' | '30') => void;
  categories: string[];
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
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

export const TemplateControlPanel = memo(function TemplateControlPanel({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  statusFilter,
  onStatusFilterChange,
  dateRangeFilter,
  onDateRangeFilterChange,
  categories,
  onImport,
  onExport,
  onAdd,
  isImporting,
}: TemplateControlPanelProps) {
  useCtrlFFocus('[data-ctrlf-target="template-search"]', true);

  const tabs: ControlPanelTabConfig[] = [
    {
      value: 'template',
      label: 'Records',
      leftSection: <IconLayoutGrid size={16} />,
      panel: (
        <Group wrap="wrap" gap="sm">
          <TextInput
            placeholder="Search primary, secondary, or notes"
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 240 }}
            data-ctrlf-target="template-search"
          />
          <Select
            placeholder="Filter by category"
            data={[
              { label: 'All Categories', value: 'all' },
              ...categories.map((c) => ({ label: c, value: c })),
            ]}
            value={categoryFilter || 'all'}
            onChange={(value) =>
              onCategoryFilterChange(value && value !== 'all' ? value : null)
            }
            leftSection={<IconFilter size={14} />}
            style={{ width: 200 }}
            searchable
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
            Add Record
          </Button>
        </Group>
      ),
    },
  ];

  return (
    <ControlPanelCard
      title="Template Records"
      tabs={tabs}
      activeTab="template"
      onTabChange={() => undefined}
    />
  );
});
