import React, { useState, memo } from 'react';
import {
  Card,
  Stack,
  Title,
  Tabs,
  Group,
  TextInput,
  Select,
  FileButton,
  Button,
} from '@mantine/core';
import {
  IconList,
  IconCalendar,
  IconSearch,
  IconUpload,
  IconDownload,
  IconPlus,
} from '@tabler/icons-react';
import { actionButtonStyles } from '@/components/shared/styles/actionButtonStyles';
import { CalendarBulkActions } from './CalendarBulkActions';
import type { EmployeeSummary, RecurringRule, ShiftType } from '../types';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';

interface ScheduleControlsProps {
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterShiftType: string | null;
  onShiftTypeFilterChange: (shiftType: string | null) => void;
  filterStatus: string | null;
  onStatusFilterChange: (status: string | null) => void;
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  onAddSchedule?: () => void;
  isImporting: boolean;
  recurringRules: RecurringRule[];
  onSaveRecurringRule: (
    rule: Omit<RecurringRule, 'id'> & { id?: string }
  ) => string;
  onDeleteRecurringRule: (id: string) => void;
  employees: EmployeeSummary[];
  isLoadingEmployees: boolean;
  shiftConfig: Record<ShiftType, { start: string; end: string; label: string }>;
  dayLabels: string[];
}

/**
 * ScheduleControls Component
 *
 * Header section with tabs, filters, and action buttons
 */
export const ScheduleControls = memo(function ScheduleControls({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  filterShiftType,
  onShiftTypeFilterChange,
  filterStatus,
  onStatusFilterChange,
  onImportCSV,
  onExportCSV,
  onAddSchedule: _onAddSchedule,
  isImporting,
  recurringRules,
  onSaveRecurringRule,
  onDeleteRecurringRule,
  employees,
  isLoadingEmployees,
  shiftConfig,
  dayLabels,
}: ScheduleControlsProps) {
  const [openRecurringRulesModal, setOpenRecurringRulesModal] = useState(false);

  useCtrlFFocus(
    '[data-ctrlf-target="schedule-controls-search"]',
    activeTab === 'list'
  );

  const handleAddScheduleClick = () => {
    setOpenRecurringRulesModal(true);
  };

  return (
    <Card
      padding="lg"
      radius="xl"
      style={{
        background: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(15px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.2)',
        transition: 'all 0.3s ease',
      }}
    >
      <Stack gap="md">
        <Title
          order={3}
          style={{
            color: 'rgba(255, 255, 255, 0.95)',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          }}
        >
          Employee Schedules
        </Title>

        <Tabs value={activeTab} onChange={onTabChange}>
          <Tabs.List>
            <Tabs.Tab value="list" leftSection={<IconList size={16} />}>
              Schedule List
            </Tabs.Tab>
            <Tabs.Tab value="calendar" leftSection={<IconCalendar size={16} />}>
              Calendar View
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="list" pt="md">
            <Group wrap="wrap" justify="space-between" gap="sm">
              <Group gap="sm" style={{ flex: 1 }}>
                <TextInput
                  placeholder="Search schedules..."
                  leftSection={<IconSearch size={16} />}
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  style={{ flex: 1, minWidth: '220px' }}
                  data-ctrlf-target="schedule-controls-search"
                />
                <Select
                  placeholder="Filter by shift type"
                  data={['All', 'morning', 'afternoon', 'night', 'full-day']}
                  value={filterShiftType}
                  onChange={(value) =>
                    onShiftTypeFilterChange(value === 'All' ? null : value)
                  }
                  clearable
                  style={{ width: 200, minWidth: '180px' }}
                />
                <Select
                  placeholder="Filter by status"
                  data={['All', 'scheduled', 'completed', 'cancelled']}
                  value={filterStatus}
                  onChange={(value) =>
                    onStatusFilterChange(value === 'All' ? null : value)
                  }
                  clearable
                  style={{ width: 200, minWidth: '180px' }}
                />
              </Group>
              <Group gap="sm">
                <CalendarBulkActions
                  recurringRules={recurringRules}
                  onSaveRule={onSaveRecurringRule}
                  onDeleteRule={onDeleteRecurringRule}
                  employees={employees}
                  isLoadingEmployees={isLoadingEmployees}
                  shiftConfig={shiftConfig}
                  dayLabels={dayLabels}
                  openRecurringRulesModal={openRecurringRulesModal}
                  onRecurringRulesModalChange={setOpenRecurringRulesModal}
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
                  onClick={handleAddScheduleClick}
                >
                  Add Schedule
                </Button>
              </Group>
            </Group>
          </Tabs.Panel>

          <Tabs.Panel value="calendar" pt="md">
            {null}
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Card>
  );
});
