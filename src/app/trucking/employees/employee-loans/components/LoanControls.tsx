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

interface LoanControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  loanTypeFilter: string | null;
  onLoanTypeFilterChange: (type: string | null) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  onAddLoan: () => void;
  isImporting?: boolean;
}

export const LoanControls = memo(function LoanControls({
  searchQuery,
  onSearchChange,
  loanTypeFilter,
  onLoanTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  onImportCSV,
  onExportCSV,
  onAddLoan,
  isImporting,
}: LoanControlsProps) {
  useCtrlFFocus('[data-ctrlf-target="loan-controls-search"]', true);

  const tabs: ControlPanelTabConfig[] = [
    {
      value: 'list',
      label: 'Loan Applications',
      leftSection: <IconList size={16} />,
      panel: (
        <Group wrap="wrap" gap="sm">
          <TextInput
            placeholder="Search by employee, purpose, or loan type..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 220 }}
            data-ctrlf-target="loan-controls-search"
          />
          <Select
            placeholder="Filter by type"
            data={[
              'All',
              'personal',
              'emergency',
              'educational',
              'housing',
              'vehicle',
            ]}
            value={loanTypeFilter}
            onChange={onLoanTypeFilterChange}
            clearable
            style={{ width: 220 }}
          />
          <Select
            placeholder="Filter by status"
            data={[
              'All',
              'pending',
              'approved',
              'active',
              'completed',
              'rejected',
            ]}
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
            onClick={onAddLoan}
          >
            Add Loan
          </Button>
        </Group>
      ),
    },
  ];

  return (
    <ControlPanelCard
      title="Employee Loan Records"
      tabs={tabs}
      activeTab="list"
      onTabChange={() => {}}
    />
  );
});
