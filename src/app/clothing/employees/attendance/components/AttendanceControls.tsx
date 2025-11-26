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
import type { AttendanceRecord } from '../types';

interface AttendanceControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: AttendanceRecord['status'] | 'all';
  onStatusFilterChange: (status: AttendanceRecord['status'] | 'all') => void;
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  onAddRecord: () => void;
  isImporting?: boolean;
}

export const AttendanceControls = memo(function AttendanceControls({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onImportCSV,
  onExportCSV,
  onAddRecord,
  isImporting,
}: AttendanceControlsProps) {
  useCtrlFFocus('[data-ctrlf-target="attendance-controls-search"]', true);

  const tabs: ControlPanelTabConfig[] = [
    {
      value: 'list',
      label: 'Attendance List',
      leftSection: <IconList size={16} />,
      panel: (
        <Group wrap="wrap" gap="sm">
          <TextInput
            placeholder="Search attendance records..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 220 }}
            data-ctrlf-target="attendance-controls-search"
          />
          <Select
            placeholder="Filter by status"
            data={['All', 'present', 'late', 'absent', 'on-leave']}
            value={statusFilter === 'all' ? 'All' : statusFilter}
            onChange={(value) =>
              onStatusFilterChange(
                !value || value === 'All'
                  ? 'all'
                  : (value as AttendanceRecord['status'])
              )
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
            Record Attendance
          </Button>
        </Group>
      ),
    },
  ];

  return (
    <ControlPanelCard
      title="Attendance Records"
      tabs={tabs}
      activeTab="list"
      onTabChange={() => {}}
    />
  );
});
