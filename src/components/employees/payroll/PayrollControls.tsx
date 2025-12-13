import { memo } from 'react';
import { Group, TextInput, Select, FileButton, Button } from '@mantine/core';
import {
  IconList,
  IconSearch,
  IconUpload,
  IconDownload,
  IconPlus,
  IconEdit,
} from '@tabler/icons-react';
import {
  ControlPanelCard,
  type ControlPanelTabConfig,
} from '@/components/ui/ControlPanelCard';
import { actionButtonStyles } from '@/components/shared/styles/actionButtonStyles';

interface PayrollControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  payPeriodFilter: string;
  onPayPeriodFilterChange: (period: string) => void;
  payPeriods: string[];
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  onAddPayroll: () => void;
  onOpenManualPayroll?: () => void;
  manualButtonLabel?: string;
  addButtonLabel?: string;
  onGeneratePayslips: () => void;
  isGeneratingPayroll: boolean;
  isGeneratingPayslips: boolean;
  isImporting?: boolean;
  title?: string;
}

export const PayrollControls = memo(function PayrollControls({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  payPeriodFilter,
  onPayPeriodFilterChange,
  payPeriods,
  onImportCSV,
  onExportCSV,
  onAddPayroll,
  onOpenManualPayroll,
  manualButtonLabel = 'Add Manual Payroll',
  addButtonLabel = 'Generate Payroll',
  onGeneratePayslips,
  isGeneratingPayroll,
  isGeneratingPayslips,
  isImporting,
  title = 'Payroll Records',
}: PayrollControlsProps) {
  const tabs: ControlPanelTabConfig[] = [
    {
      value: 'list',
      label: 'Payroll List',
      leftSection: <IconList size={16} />,
      panel: (
        <Group wrap="wrap" gap="sm">
          <TextInput
            placeholder="Search payroll records..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <Select
            placeholder="Filter by status"
            data={['All', 'pending', 'approved', 'paid']}
            value={statusFilter === 'all' ? 'All' : statusFilter}
            onChange={(value) =>
              onStatusFilterChange(!value || value === 'All' ? 'all' : value)
            }
            clearable
            style={{ width: 200 }}
          />
          <Select
            placeholder="Filter by pay period"
            data={payPeriods.map((period) =>
              period === 'all' ? 'All' : period
            )}
            value={payPeriodFilter === 'all' ? 'All' : payPeriodFilter}
            onChange={(value) =>
              onPayPeriodFilterChange(!value || value === 'All' ? 'all' : value)
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
          {onOpenManualPayroll && (
            <Button
              leftSection={<IconEdit size={16} />}
              size="sm"
              radius="sm"
              variant="outline"
              color="teal"
              onClick={onOpenManualPayroll}
              disabled={isGeneratingPayroll || isGeneratingPayslips}
            >
              {manualButtonLabel}
            </Button>
          )}
          <Button
            leftSection={<IconPlus size={16} />}
            size="sm"
            radius="sm"
            color="green"
            onClick={onAddPayroll}
            loading={isGeneratingPayroll}
            disabled={isGeneratingPayslips}
          >
            {addButtonLabel}
          </Button>
          <Button
            leftSection={<IconDownload size={16} />}
            size="sm"
            radius="sm"
            variant="outline"
            color="blue"
            onClick={onGeneratePayslips}
            loading={isGeneratingPayslips}
            disabled={isGeneratingPayroll}
          >
            Generate Payslips
          </Button>
        </Group>
      ),
    },
  ];

  return (
    <ControlPanelCard
      title={title}
      tabs={tabs}
      activeTab="list"
      onTabChange={() => {}}
    />
  );
});
