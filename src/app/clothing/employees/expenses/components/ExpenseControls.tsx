import React, { memo } from 'react';
import { Group, TextInput, Select, FileButton, Button } from '@mantine/core';
import {
  IconList,
  IconChartPie,
  IconSearch,
  IconUpload,
  IconDownload,
  IconPlus,
} from '@tabler/icons-react';
import { actionButtonStyles } from '@/components/shared/styles/actionButtonStyles';
import {
  ControlPanelCard,
  type ControlPanelTabConfig,
} from '@/components/ui/ControlPanelCard';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';

interface ExpenseControlsProps {
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterCategory: string | null;
  onCategoryFilterChange: (category: string | null) => void;
  filterStatus: string | null;
  onStatusFilterChange: (status: string | null) => void;
  categories: string[];
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  onAddExpense: () => void;
  isImporting: boolean;
}

/**
 * ExpenseControls Component
 *
 * Header section with tabs, filters, and action buttons
 */
export const ExpenseControls = memo(function ExpenseControls({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  filterCategory,
  onCategoryFilterChange,
  filterStatus,
  onStatusFilterChange,
  categories,
  onImportCSV,
  onExportCSV,
  onAddExpense,
  isImporting,
}: ExpenseControlsProps) {
  useCtrlFFocus(
    '[data-ctrlf-target="expense-controls-search"]',
    activeTab === 'list'
  );

  const tabs: ControlPanelTabConfig[] = [
    {
      value: 'list',
      label: 'Expense List',
      leftSection: <IconList size={16} />,
      panel: (
        <Group wrap="wrap" gap="sm">
          <TextInput
            placeholder="Search expenses..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
            data-ctrlf-target="expense-controls-search"
          />
          <Select
            placeholder="Filter by category"
            data={['All', ...categories]}
            value={filterCategory}
            onChange={(value) =>
              onCategoryFilterChange(value === 'All' ? null : value)
            }
            clearable
            style={{ width: 200 }}
          />
          <Select
            placeholder="Filter by status"
            data={['All', 'pending', 'approved', 'rejected']}
            value={filterStatus}
            onChange={(value) =>
              onStatusFilterChange(value === 'All' ? null : value)
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
            onClick={onAddExpense}
          >
            Add Expense
          </Button>
        </Group>
      ),
    },
    {
      value: 'analytics',
      label: 'Analytics by Category',
      leftSection: <IconChartPie size={16} />,
      panel: <div />,
    },
  ];

  return (
    <ControlPanelCard
      title="Expense Records"
      activeTab={activeTab}
      onTabChange={onTabChange}
      tabs={tabs}
    />
  );
});
