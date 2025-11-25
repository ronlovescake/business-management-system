import React from 'react';
import { PageControls } from '@/components/shared/PageTemplates';
import type {
  TabConfig,
  FilterConfig,
} from '@/components/shared/PageTemplates';
import { IconList, IconChartPie, IconCalendar } from '@tabler/icons-react';
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
  const tabs: TabConfig[] = [
    {
      value: 'list',
      label: 'Leave Requests',
      icon: <IconList size={16} />,
    },
    {
      value: 'analytics',
      label: 'Analytics by Type',
      icon: <IconChartPie size={16} />,
    },
    {
      value: 'calendar',
      label: 'Calendar View',
      icon: <IconCalendar size={16} />,
    },
  ];

  const filters: FilterConfig[] = [
    {
      placeholder: 'Filter by leave type',
      data: ['All', ...leaveTypes],
      value: filterLeaveType,
      onChange: (value: string | null) =>
        onLeaveTypeFilterChange(value === 'All' ? null : value),
    },
    {
      placeholder: 'Filter by status',
      data: ['All', 'pending', 'approved', 'rejected'],
      value: filterStatus,
      onChange: (value: string | null) =>
        onStatusFilterChange(value === 'All' ? null : value),
    },
  ];

  return (
    <PageControls
      title="Leave Tracker"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      searchPlaceholder="Search leave requests..."
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      filters={filters}
      onImportCSV={onImportCSV}
      onExportCSV={onExportCSV}
      onAdd={onAddRequest}
      addButtonLabel="Add Leave Request"
      isImporting={isImporting}
    />
  );
});
