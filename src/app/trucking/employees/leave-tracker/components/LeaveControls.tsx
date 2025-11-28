import React from 'react';
import { Group, TextInput, Select, FileButton, Button } from '@mantine/core';
import {
  IconList,
  IconChartPie,
  IconCalendar,
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
import type { LeaveType } from '../types';

interface LeaveControlsProps {
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterLeaveType: string | null;
  onLeaveTypeFilterChange: (leaveType: string | null) => void;
  filterStatus: string | null;
  onStatusFilterChange: (status: string | null) => void;
  leaveTypes: LeaveType[];
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  onAddRequest: () => void;
  isImporting: boolean;
}

export const LeaveControls = React.memo(function LeaveControls({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  filterLeaveType,
  onLeaveTypeFilterChange,
  filterStatus,
  onStatusFilterChange,
  leaveTypes,
  onImportCSV,
  onExportCSV,
  onAddRequest,
  isImporting,
}: LeaveControlsProps) {
  useCtrlFFocus(
    '[data-ctrlf-target="leave-controls-search"]',
    activeTab === 'list'
  );

  const tabs: ControlPanelTabConfig[] = [
    {
      value: 'list',
      label: 'Leave Requests',
      leftSection: <IconList size={16} />,
      panel: (
        <Group wrap="wrap" gap="sm">
          <TextInput
            placeholder="Search leave requests..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 220 }}
            data-ctrlf-target="leave-controls-search"
          />
          <Select
            placeholder="Filter by leave type"
            data={['All', ...leaveTypes]}
            value={filterLeaveType}
            onChange={(value) =>
              onLeaveTypeFilterChange(value === 'All' ? null : value)
            }
            clearable
            style={{ width: 220 }}
          />
          <Select
            placeholder="Filter by status"
            data={['All', 'pending', 'approved', 'rejected']}
            value={filterStatus}
            onChange={(value) =>
              onStatusFilterChange(value === 'All' ? null : value)
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
            Add Leave Request
          </Button>
        </Group>
      ),
    },
    {
      value: 'analytics',
      label: 'Analytics by Type',
      leftSection: <IconChartPie size={16} />,
      panel: null,
    },
    {
      value: 'calendar',
      label: 'Calendar View',
      leftSection: <IconCalendar size={16} />,
      panel: null,
    },
  ];

  return (
    <ControlPanelCard
      title="Leave Tracker"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
    />
  );
});
