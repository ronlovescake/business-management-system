import React, { memo } from 'react';
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

interface CashAdvanceControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  onAddRequest: () => void;
  isImporting?: boolean;
}

export const CashAdvanceControls = memo(function CashAdvanceControls({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onImportCSV,
  onExportCSV,
  onAddRequest,
  isImporting,
}: CashAdvanceControlsProps) {
  useCtrlFFocus('[data-ctrlf-target="cash-advance-controls-search"]', true);

  const tabs: ControlPanelTabConfig[] = [
    {
      value: 'list',
      label: 'Cash Advance List',
      leftSection: <IconList size={16} />,
      panel: (
        <Group wrap="wrap" gap="sm">
          <TextInput
            placeholder="Search by employee, purpose, or terms..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 220 }}
            data-ctrlf-target="cash-advance-controls-search"
          />
          <Select
            placeholder="Filter by status"
            data={['All', 'pending', 'approved', 'rejected', 'paid']}
            value={statusFilter === 'all' ? 'All' : statusFilter}
            onChange={(value) =>
              onStatusFilterChange(!value || value === 'All' ? 'all' : value)
            }
            clearable
            style={{ width: 220 }}
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
            onClick={onAddRequest}
          >
            Add Request
          </Button>
        </Group>
      ),
    },
  ];

  return (
    <ControlPanelCard
      title="Cash Advance Records"
      tabs={tabs}
      activeTab="list"
      onTabChange={() => {}}
    />
  );
});
