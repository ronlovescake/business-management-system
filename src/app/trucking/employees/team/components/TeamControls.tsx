import React, { memo } from 'react';
import { Group, TextInput, Select, FileButton, Button } from '@mantine/core';
import {
  IconList,
  IconChartBar,
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
import { EMPLOYEE_STATUS_OPTIONS, type EmployeeStatus } from '../types';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...EMPLOYEE_STATUS_OPTIONS,
];

interface TeamControlsProps {
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  departments: string[];
  departmentFilter: string;
  onDepartmentFilterChange: (department: string) => void;
  statusFilter: EmployeeStatus | 'all';
  onStatusFilterChange: (status: EmployeeStatus | 'all') => void;
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  onAddEmployee: () => void;
  isImporting?: boolean;
}

export const TeamControls = memo(function TeamControls({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  departments,
  departmentFilter,
  onDepartmentFilterChange,
  statusFilter,
  onStatusFilterChange,
  onImportCSV,
  onExportCSV,
  onAddEmployee,
  isImporting,
}: TeamControlsProps) {
  useCtrlFFocus(
    '[data-ctrlf-target="team-controls-search"]',
    activeTab === 'employees'
  );

  const tabs: ControlPanelTabConfig[] = [
    {
      value: 'employees',
      label: 'Employees',
      leftSection: <IconList size={16} />,
      panel: (
        <Group wrap="wrap" gap="sm">
          <TextInput
            placeholder="Search by name, ID, department, or contact..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 220 }}
            data-ctrlf-target="team-controls-search"
          />
          <Select
            placeholder="Filter by department"
            data={departments.map((dept) => (dept === 'all' ? 'All' : dept))}
            value={departmentFilter === 'all' ? 'All' : departmentFilter}
            onChange={(value) =>
              onDepartmentFilterChange(
                !value || value === 'All' ? 'all' : value
              )
            }
            clearable
            style={{ width: 220 }}
          />
          <Select
            placeholder="Filter by status"
            data={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(value) =>
              onStatusFilterChange((value as EmployeeStatus | 'all') || 'all')
            }
            clearable
            withCheckIcon={false}
            comboboxProps={{ withinPortal: true, zIndex: 500 }}
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
            onClick={onAddEmployee}
          >
            Add Employee
          </Button>
        </Group>
      ),
    },
    {
      value: 'analytics',
      label: 'Analytics',
      leftSection: <IconChartBar size={16} />,
      panel: null,
    },
  ];

  return (
    <ControlPanelCard
      title="Team Management"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
    />
  );
});
